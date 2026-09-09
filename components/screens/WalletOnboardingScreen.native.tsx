import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from '@stripe/stripe-react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import LoadingBlock from '@/components/LoadingBlock';
import { PreOnboardingForm } from '@/components/wallet/PreOnboardingForm';
import PreviewUnavailable from '@/components/PreviewUnavailable';
import { PRELAUNCH_MODE } from '@/lib/launchConfig';
import { haptics } from '@/lib/haptics';

type Step = 'checking' | 'pre-onboarding' | 'stripe' | 'error';

interface ProfileData {
  username: string | null;
  display_name: string | null;
  phone_number: string | null;
  location_data: Record<string, string> | null;
  is_pro: boolean;
  business_name: string | null;
}

function profileIsComplete(p: ProfileData | null): boolean {
  if (!p) return false;
  return Boolean(p.display_name?.trim()) && Boolean(p.phone_number?.trim()) && Boolean((p.location_data as any)?.city?.trim());
}

const FUNCTIONS = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;

async function authedPost(path: string): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Session expirée. Reconnecte-toi.');
  const res = await fetch(`${FUNCTIONS}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({}),
  });
  return res.json();
}

/**
 * Onboarding Stripe 100 % natif (iOS/Android) : le composant Connect
 * « Account onboarding » de Stripe s'affiche dans l'app, avec nos couleurs.
 * Même préparation que sur le web : compléter le profil si besoin, puis
 * session de compte via l'edge function create-account-session.
 */
export default function WalletOnboardingNative() {
  if (PRELAUNCH_MODE) {
    return (
      <PreviewUnavailable
        title="Portefeuille pas encore disponible"
        description="La configuration Stripe s'ouvrira avec la marketplace. Tu pourras la faire au lancement, avant tes premières locations."
      />
    );
  }
  return <WalletOnboardingContent />;
}

function WalletOnboardingContent() {
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [step, setStep] = useState<Step>('checking');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setErrorMessage('Session expirée. Reconnecte-toi.');
          setStep('error');
          return;
        }
        setUserId(session.user.id);
        const { data: rows } = await supabase.rpc('get_my_profile');
        const p = (Array.isArray(rows) ? rows[0] : rows) ?? null;
        setProfile(p);
        if (mode === 'edit' || profileIsComplete(p)) {
          startStripe();
        } else {
          setStep('pre-onboarding');
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Erreur lors du chargement');
        setStep('error');
      }
    })();
  }, []);

  const startStripe = () => {
    try {
      const instance = loadConnectAndInitialize({
        publishableKey,
        locale: 'fr-FR',
        fetchClientSecret: async () => {
          const data = await authedPost('create-account-session');
          if (data?.error) throw new Error(data.error);
          return data.client_secret;
        },
        appearance: {
          variables: {
            colorPrimary: Colors.primaryDark,
            colorBackground: '#FFFFFF',
            colorText: Colors.text,
            colorSecondaryText: '#6B6B6B',
            colorBorder: '#E8E5D8',
            colorDanger: '#C25450',
            buttonPrimaryColorBackground: Colors.primaryDark,
            buttonPrimaryColorText: '#FFFFFF',
            buttonPrimaryColorBorder: Colors.primaryDark,
            borderRadius: '12px',
            fontSizeBase: '15px',
          },
        },
      });
      setConnectInstance(instance);
      setStep('stripe');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors du chargement');
      setStep('error');
    }
  };

  const finish = async () => {
    // Synchronise charges_enabled / payouts_enabled sur le profil avant de revenir.
    try { await authedPost('check-account-status'); } catch {}
    haptics.success();
    router.replace(mode === 'edit' ? ('/wallet/manage' as any) : ('/wallet' as any));
  };

  if (step === 'checking') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <LoadingBlock label="Préparation de la vérification sécurisée…" />
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>Impossible d'ouvrir la vérification</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/wallet' as any)} activeOpacity={0.85}>
          <Text style={styles.retryBtnText}>Retour au portefeuille</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fallbackBtn} onPress={() => router.replace('/wallet?hosted=1' as any)} activeOpacity={0.7}>
          <Text style={styles.fallbackBtnText}>Continuer dans Safari</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/wallet' as any)} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {mode === 'edit' ? 'Modifier mes informations' : 'Active tes virements'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {step === 'pre-onboarding' && userId && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.reassureCard}>
            <Text style={styles.reassureTitle}>Tu ne crées pas une entreprise</Text>
            <Text style={styles.reassureSubtitle}>
              Pour recevoir tes gains, Stripe doit vérifier ton identité. C'est une obligation réglementaire, même pour les particuliers. LoueTonBien ne voit jamais tes données bancaires.
            </Text>
          </View>
          <PreOnboardingForm
            userId={userId}
            initialData={{
              username: profile?.username ?? undefined,
              display_name: profile?.display_name ?? undefined,
              phone_number: profile?.phone_number ?? undefined,
              city: (profile?.location_data as any)?.city ?? undefined,
              is_pro: profile?.is_pro ?? false,
              business_name: profile?.business_name ?? undefined,
            }}
            onComplete={startStripe}
          />
        </ScrollView>
        </KeyboardAvoidingView>
      )}

      {step === 'stripe' && connectInstance && (
        <>
          <View style={styles.center}>
            <LoadingBlock label="Ouverture de la vérification Stripe…" />
          </View>
          {/* Composant natif Stripe : s'affiche en plein écran dès qu'il est monté. */}
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <ConnectAccountOnboarding
              title={mode === 'edit' ? 'Mes informations' : 'Vérification'}
              onExit={finish}
              onLoadError={({ error }) => {
                setErrorMessage(error?.message ?? 'Stripe est indisponible pour le moment.');
                setStep('error');
              }}
              fullTermsOfServiceUrl="https://app.louetonbien.fr/legal"
              privacyPolicyUrl="https://app.louetonbien.fr/legal"
              collectionOptions={{ fields: 'currently_due', futureRequirements: 'include' }}
            />
          </ConnectComponentsProvider>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7E3D5',
  },
  headerTitle: { flex: 1, fontFamily: 'Inter-Bold', fontSize: 17, color: Colors.text, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  reassureCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: '#EDEAE0',
  },
  reassureTitle: { fontFamily: 'Inter-Bold', fontSize: 15, color: Colors.text },
  reassureSubtitle: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
  errorTitle: { fontFamily: 'Inter-Bold', fontSize: 17, color: Colors.text, textAlign: 'center' },
  errorText: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: Colors.textMuted, textAlign: 'center' },
  retryBtn: { marginTop: 10, backgroundColor: Colors.primaryDark, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  retryBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.white },
  fallbackBtn: { paddingVertical: 8 },
  fallbackBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.primaryDark },
});
