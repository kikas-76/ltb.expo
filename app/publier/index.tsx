import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import LoadingBlock from '@/components/LoadingBlock';
import CreateListingScreen, { type GuestDraft } from '@/components/screens/CreateListingScreen';
import PublishIntro from '@/components/publier/PublishIntro';
import AccountStep, { type DraftSummary } from '@/components/publier/AccountStep';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { setAuthReturnPath } from '@/lib/authReturn';
import {
  clearDraftToken,
  clearLocalDraft,
  fetchDraftStatus,
  getDraftToken,
  loadLocalDraft,
  rememberSource,
  saveLocalDraft,
  uploadDraft,
} from '@/lib/publishDraft';

type Phase = 'loading' | 'intro' | 'edit' | 'account';

function summaryOf(d: GuestDraft): DraftSummary {
  return {
    name: d.name.trim(),
    price: parseFloat(d.price) || 0,
    city: d.location?.city ?? null,
    photoUri: d.photos[0]?.uri ?? null,
  };
}

/**
 * Lien de partage https://app.louetonbien.fr/publier (?ref=canal) :
 * présenter LoueTonBien, laisser remplir l'annonce sans compte, puis créer le
 * compte qui la publie (fin du parcours sur /publier/terminer).
 */
export default function PublierScreen() {
  const { session, loading } = useAuth();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [initial, setInitial] = useState<Partial<GuestDraft> | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<DraftSummary | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const latest = useRef<GuestDraft | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    rememberSource(typeof ref === 'string' ? ref : null);
  }, [ref]);

  // Compte ouvert (ici ou dans un autre onglet) avec une annonce en attente : publier.
  useEffect(() => {
    if (!loading && session && getDraftToken()) router.replace('/publier/terminer' as any);
  }, [loading, session]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const local = await loadLocalDraft();
      if (cancelled) return;
      setInitial(local);
      const pending = getDraftToken();
      if (pending && !session) {
        const status = await fetchDraftStatus(pending);
        if (cancelled) return;
        if (status && status !== 'error' && status.status !== 'published') {
          setToken(pending);
          setSummary({
            name: status.name,
            price: status.price,
            city: status.city,
            photoUri: local?.photos?.[0]?.uri ?? status.photo_url,
          });
          setPhase('account');
          return;
        }
        if (status !== 'error') clearDraftToken();
        // Publiée depuis un autre navigateur (lien de l'email) : rien à reprendre.
        if (status && status !== 'error' && status.status === 'published') {
          await clearLocalDraft();
          if (cancelled) return;
          setInitial(null);
        }
      }
      setPhase('intro');
    })();
    return () => {
      cancelled = true;
    };
    // Chargé une fois, après la lecture de la session.
  }, [loading]);

  const handleChange = (d: GuestDraft) => {
    latest.current = d;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveLocalDraft(d), 400);
  };

  const handleSubmit = async (d: GuestDraft): Promise<string | null> => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await saveLocalDraft(d);
    const result = await uploadDraft(d);
    if ('error' in result) return result.error;
    if (session) {
      router.replace('/publier/terminer' as any);
      return null;
    }
    setToken(result.token);
    setSummary(summaryOf(d));
    setPhase('account');
    return null;
  };

  const startEditing = () => {
    // Déjà connecté et rien de commencé ici : la création d'annonce habituelle.
    if (session && !(latest.current ?? initial)) {
      router.push('/create-listing');
      return;
    }
    setPhase('edit');
  };

  const restart = async () => {
    await clearLocalDraft();
    clearDraftToken();
    latest.current = null;
    setInitial(null);
    setEditorKey((k) => k + 1);
    setPhase('edit');
  };

  if (phase === 'loading') {
    return (
      <View style={styles.loading}>
        <LoadingBlock fill={false} />
      </View>
    );
  }

  if (phase === 'account' && token) {
    return (
      <AccountStep
        token={token}
        summary={summary}
        onEdit={() => {
          clearDraftToken();
          setToken(null);
          if (latest.current) setInitial(latest.current);
          setEditorKey((k) => k + 1);
          setPhase('edit');
        }}
      />
    );
  }

  if (phase === 'edit') {
    return (
      <CreateListingScreen
        key={editorKey}
        guest={{
          initial: latest.current ?? initial ?? undefined,
          onChange: handleChange,
          onSubmit: handleSubmit,
          onExit: () => setPhase('intro'),
        }}
      />
    );
  }

  return (
    <PublishIntro
      hasDraft={!!(latest.current ?? initial)}
      onStart={startEditing}
      onRestart={restart}
      onSignIn={
        session
          ? undefined
          : () => {
              setAuthReturnPath('/create-listing');
              router.push('/login');
            }
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});
