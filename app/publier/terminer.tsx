import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingBlock from '@/components/LoadingBlock';
import HowItWorks from '@/components/publier/HowItWorks';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { setAuthReturnPath } from '@/lib/authReturn';
import {
  clearDraftToken,
  fetchDraftStatus,
  forgetPublishDraft,
  publishDraft,
  resolveDraftToken,
  type DraftStatus,
} from '@/lib/publishDraft';

type Phase = 'loading' | 'signin' | 'nodraft' | 'expired' | 'profile' | 'publishing' | 'done' | 'error';

interface PublishedListing {
  id: string;
  name: string;
  price: number;
  photo: string | null;
}

function suggestUsername(meta: Record<string, any> | undefined, email: string | undefined): string {
  const fromName = String(meta?.full_name ?? meta?.name ?? meta?.given_name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.-]/g, '');
  if (fromName.length >= 3) return fromName.slice(0, 30);
  const fromEmail = (email ?? '').split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return fromEmail.length >= 3 ? fromEmail.slice(0, 30) : '';
}

/**
 * Fin du lien /publier, une fois connecté : pseudo (compte neuf), publication
 * de l'annonce préparée, puis explication du fonctionnement.
 */
export default function PublierTerminerScreen() {
  const insets = useSafeAreaInsets();
  const { session, user, profile, loading, profileLoading, refreshProfile } = useAuth();
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<DraftStatus | null>(null);
  const [username, setUsername] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listing, setListing] = useState<PublishedListing | null>(null);
  // Clé de la dernière vérification : on recommence quand la personne se connecte.
  const startedFor = useRef<string | null>(null);

  const token = resolveDraftToken(user?.user_metadata);

  const finish = useCallback(async (listingId: string) => {
    const { data } = await supabase
      .from('listings')
      .select('id, name, price, photos_url')
      .eq('id', listingId)
      .maybeSingle();
    setListing({
      id: listingId,
      name: data?.name ?? '',
      price: Number(data?.price ?? 0),
      photo: (data?.photos_url as string[] | null)?.[0] ?? null,
    });
    setPhase('done');
    await forgetPublishDraft();
    if (user?.user_metadata?.publish_draft) {
      supabase.auth.updateUser({ data: { publish_draft: null } }).catch(() => {});
    }
  }, [user]);

  const publish = useCallback(async (t: string) => {
    setPhase('publishing');
    for (let attempt = 0; attempt < 30; attempt++) {
      const res = await publishDraft(t);
      if (res.status === 'published') {
        await finish(res.listingId);
        return;
      }
      if (res.status === 'error') {
        if (res.code === 'profile_incomplete') {
          setPhase('profile');
          return;
        }
        if (res.code === 'draft_not_found') {
          setPhase('expired');
          return;
        }
        setErrorMessage(
          res.code === 'already_published'
            ? 'Cette annonce a déjà été publiée avec un autre compte.'
            : res.message,
        );
        setPhase('error');
        return;
      }
      // Un autre onglet publie déjà : attendre qu'il ait fini.
      await new Promise((r) => setTimeout(r, 2000));
    }
    setErrorMessage('La publication prend plus de temps que prévu. Réessayez dans un instant.');
    setPhase('error');
  }, [finish]);

  useEffect(() => {
    const key = session?.user?.id ?? 'visiteur';
    if (loading || profileLoading || startedFor.current === key) return;
    if (session && !profile) return; // profil en cours de lecture
    if (!token) {
      setPhase('nodraft');
      return;
    }
    startedFor.current = key;
    (async () => {
      const s = await fetchDraftStatus(token);
      if (s === null) {
        setPhase('expired');
        return;
      }
      if (s !== 'error') setStatus(s);
      if (!session) {
        setPhase('signin');
        return;
      }
      if (!profile?.onboarding_completed) {
        setUsername(suggestUsername(user?.user_metadata, user?.email));
        setPhase('profile');
        return;
      }
      publish(token);
    })();
  }, [loading, profileLoading, session, profile, token]);

  const saveProfile = async () => {
    if (!user || !token) return;
    setFormError(null);
    const clean = username.trim().toLowerCase().replace(/\s/g, '');
    if (clean.length < 3) {
      setFormError('Le pseudo doit contenir au moins 3 caractères.');
      return;
    }
    if (clean.length > 30) {
      setFormError('Le pseudo doit contenir au plus 30 caractères.');
      return;
    }
    if (!/^[a-z0-9_.-]+$/.test(clean)) {
      setFormError('Uniquement des lettres sans accent, des chiffres, _ . ou -');
      return;
    }
    setSaving(true);
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', clean)
      .neq('id', user.id)
      .maybeSingle();
    if (taken) {
      setSaving(false);
      setFormError('Ce pseudo est déjà pris. Choisissez-en un autre.');
      return;
    }
    const meta = user.user_metadata ?? {};
    const avatar = typeof (meta.avatar_url ?? meta.picture) === 'string' ? (meta.avatar_url ?? meta.picture) : null;
    const updates: Record<string, unknown> = {
      username: clean,
      email: user.email ?? null,
      is_pro: false,
      onboarding_completed: true,
      terms_accepted_at: new Date().toISOString(),
    };
    if (avatar && !profile?.photo_url) updates.photo_url = avatar;
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) {
      setSaving(false);
      setFormError(error.code === '23505' ? 'Ce pseudo est déjà pris. Choisissez-en un autre.' : 'Enregistrement impossible. Réessayez.');
      return;
    }
    await refreshProfile();
    setSaving(false);
    publish(token);
  };

  const goSignIn = () => {
    setAuthReturnPath('/publier/terminer');
    router.push('/login');
  };

  // ─── Rendu ───────────────────────────────────────────────────────────────

  if (phase === 'loading' || phase === 'publishing') {
    return (
      <View style={styles.center}>
        <LoadingBlock fill={false} />
        {phase === 'publishing' && <Text style={styles.centerText}>Publication de votre annonce…</Text>}
      </View>
    );
  }

  const page = (children: React.ReactNode) => (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const draftCard = status && (
    <View style={styles.card}>
      {status.photo_url ? (
        <Image source={{ uri: status.photo_url }} style={styles.cardPhoto} resizeMode="cover" />
      ) : null}
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{status.name}</Text>
        <Text style={styles.cardPrice}>
          {Number(status.price).toFixed(2)} € <Text style={styles.cardUnit}>/ jour</Text>
        </Text>
        {status.city && <Text style={styles.cardCity}>{status.city}</Text>}
      </View>
    </View>
  );

  if (phase === 'profile') {
    return page(
      <>
        <Text style={styles.kicker}>Compte créé</Text>
        <Text style={styles.title}>Choisissez votre pseudo</Text>
        <Text style={styles.subtitle}>C'est le nom que verront vos voisins sur votre annonce.</Text>
        {draftCard}
        <TextInput
          style={styles.input}
          placeholder="ex : marie_lyon"
          placeholderTextColor={Colors.textMuted}
          value={username}
          onChangeText={(t) => {
            setUsername(t);
            setFormError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
          onSubmitEditing={saveProfile}
        />
        {formError && <Text style={styles.formError}>{formError}</Text>}
        <TouchableOpacity
          style={[styles.cta, saving && { opacity: 0.65 }]}
          onPress={saveProfile}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.ctaText}>Publier mon annonce</Text>}
        </TouchableOpacity>
      </>,
    );
  }

  if (phase === 'signin') {
    return page(
      <>
        <Text style={styles.title}>Connectez-vous pour publier</Text>
        <Text style={styles.subtitle}>Votre annonce est prête. Il ne reste qu'à vous connecter.</Text>
        {draftCard}
        <TouchableOpacity style={styles.cta} onPress={goSignIn} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Se connecter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/publier' as any)} style={styles.linkBtn} activeOpacity={0.6}>
          <Text style={styles.linkText}>Créer un compte</Text>
        </TouchableOpacity>
      </>,
    );
  }

  if (phase === 'nodraft' || phase === 'expired') {
    return page(
      <>
        <Text style={styles.title}>
          {phase === 'expired' ? 'Ce brouillon a expiré' : 'Aucune annonce en attente'}
        </Text>
        <Text style={styles.subtitle}>
          {phase === 'expired'
            ? 'Les annonces non publiées sont gardées 7 jours. Vous pouvez en créer une nouvelle en 2 minutes.'
            : 'Vous pouvez publier une annonce en 2 minutes.'}
        </Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={async () => {
            await forgetPublishDraft();
            if (user?.user_metadata?.publish_draft) {
              await supabase.auth.updateUser({ data: { publish_draft: null } }).catch(() => {});
            }
            if (session && !profile?.onboarding_completed) router.replace('/onboarding/profile' as any);
            else router.replace((session ? '/create-listing' : '/publier') as any);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {session && !profile?.onboarding_completed ? 'Continuer' : 'Créer une annonce'}
          </Text>
        </TouchableOpacity>
      </>,
    );
  }

  if (phase === 'error') {
    return page(
      <>
        <Text style={styles.title}>Publication impossible</Text>
        <Text style={styles.subtitle}>{errorMessage}</Text>
        {token && (
          <TouchableOpacity style={styles.cta} onPress={() => publish(token)} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Réessayer</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            clearDraftToken();
            router.replace('/(tabs)');
          }}
          style={styles.linkBtn}
          activeOpacity={0.6}
        >
          <Text style={styles.linkText}>Aller sur LoueTonBien</Text>
        </TouchableOpacity>
      </>,
    );
  }

  // phase === 'done'
  return page(
    <>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={38} color={Colors.white} />
      </View>
      <Text style={styles.title}>Votre annonce est en ligne !</Text>
      <Text style={styles.subtitle}>Vos voisins peuvent déjà la voir et vous envoyer une demande.</Text>

      {listing && (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.replace(`/listing/${listing.id}` as any)}
          activeOpacity={0.85}
        >
          {listing.photo ? <Image source={{ uri: listing.photo }} style={styles.cardPhoto} resizeMode="cover" /> : null}
          <View style={styles.cardBody}>
            <Text style={styles.cardName} numberOfLines={2}>{listing.name}</Text>
            <Text style={styles.cardPrice}>
              {listing.price.toFixed(2)} € <Text style={styles.cardUnit}>/ jour</Text>
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      <HowItWorks />

      <View style={styles.wallet}>
        <View style={styles.walletHead}>
          <Ionicons name="wallet-outline" size={18} color={Colors.primaryDark} />
          <Text style={styles.walletTitle}>Pour recevoir vos gains</Text>
        </View>
        <Text style={styles.walletText}>
          Ajoutez vos informations de paiement (2 minutes). Vous pourrez aussi le faire plus tard, depuis Mon Compte puis
          Mon portefeuille.
        </Text>
        <TouchableOpacity onPress={() => router.push('/wallet' as any)} style={styles.walletBtn} activeOpacity={0.8}>
          <Text style={styles.walletBtnText}>Activer mes paiements</Text>
        </TouchableOpacity>
      </View>

      {listing && (
        <TouchableOpacity
          style={styles.cta}
          onPress={() => router.replace(`/listing/${listing.id}` as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Voir mon annonce</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.linkBtn} activeOpacity={0.6}>
        <Text style={styles.linkText}>Découvrir LoueTonBien</Text>
      </TouchableOpacity>
    </>,
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: Colors.background },
  centerText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.textSecondary },
  content: { flexGrow: 1, paddingHorizontal: 20, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 440, alignItems: 'center', gap: 14 },
  kicker: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.primaryDark,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.4,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
  },
  cardPhoto: { width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.background },
  cardBody: { flex: 1, gap: 2 },
  cardName: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.text },
  cardPrice: { fontFamily: 'Inter-Bold', fontSize: 15, color: Colors.primaryDark },
  cardUnit: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textSecondary },
  cardCity: { fontFamily: 'Inter-Regular', fontSize: 12.5, color: Colors.textSecondary },
  input: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 54,
    paddingHorizontal: 18,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: Colors.text,
  },
  formError: { alignSelf: 'stretch', fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.error },
  cta: {
    width: '100%',
    height: 56,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: 'Inter-SemiBold', fontSize: 16.5, color: Colors.white, letterSpacing: 0.2 },
  linkBtn: { paddingVertical: 6 },
  linkText: { fontFamily: 'Inter-SemiBold', fontSize: 14.5, color: Colors.primaryDark, textDecorationLine: 'underline' },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wallet: {
    width: '100%',
    backgroundColor: Colors.primaryLight + '35',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    padding: 16,
    gap: 8,
  },
  walletHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletTitle: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.primaryDark },
  walletText: { fontFamily: 'Inter-Regular', fontSize: 13.5, lineHeight: 19, color: Colors.primaryDark },
  walletBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  walletBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.primaryDark },
});
