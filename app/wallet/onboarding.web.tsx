import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform, Modal } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js';
import { Colors } from '@/constants/colors';
import { PreOnboardingForm } from '@/components/wallet/PreOnboardingForm';

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
  // The Stripe pre-fill needs the legal name (display_name). The pseudo
  // (username) is not enough on its own.
  const hasLegalName = Boolean(p.display_name?.trim());
  const hasPhone = Boolean(p.phone_number?.trim());
  const hasCity = Boolean((p.location_data as any)?.city?.trim());
  return hasLegalName && hasPhone && hasCity;
}

export default function WalletOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [step, setStep] = useState<Step>('checking');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [stripeConnectInstance, setStripeConnectInstance] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

  useEffect(() => {
    checkProfileAndDecideStep();
  }, []);

  const checkProfileAndDecideStep = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || !session.user) {
        setErrorMessage('Session expirée. Reconnecte-toi.');
        setStep('error');
        return;
      }

      setUserId(session.user.id);

      const { data: p } = await supabase
        .from('profiles')
        .select('username, display_name, phone_number, location_data, is_pro, business_name')
        .eq('id', session.user.id)
        .maybeSingle();

      setProfile(p);

      if (mode === 'edit' || profileIsComplete(p)) {
        await initStripe();
      } else {
        setStep('pre-onboarding');
      }
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Erreur lors du chargement');
      setStep('error');
    }
  };

  const initStripe = async () => {
    try {
      const instance = loadConnectAndInitialize({
        publishableKey,
        locale: 'fr',
        fetchClientSecret: async () => {
          const { data: { session: freshSession } } = await supabase.auth.getSession();
          if (!freshSession?.access_token) throw new Error('Session expirée');
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-account-session`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                'Authorization': `Bearer ${freshSession.access_token}`,
              },
              body: JSON.stringify({}),
            }
          );
          const data = await response.json();
          if (data.error) throw new Error(data.error);
          return data.client_secret;
        },
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#8E9878',
            colorBackground: '#FFFFFF',
            colorText: '#2C2C2C',
            colorSecondaryText: '#6B6B6B',
            colorBorder: '#E8E5D8',
            colorDanger: '#C25450',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSizeBase: '15px',
            borderRadius: '12px',
            spacingUnit: '12px',
            buttonPrimaryColorBackground: '#8E9878',
            buttonPrimaryColorText: '#FFFFFF',
            buttonPrimaryColorBorder: '#8E9878',
            buttonSecondaryColorBackground: '#FFFFFF',
            buttonSecondaryColorText: '#2C2C2C',
            buttonSecondaryColorBorder: '#D9D5C8',
            formBackgroundColor: '#FAFAF5',
            formHighlightColorBorder: '#8E9878',
          },
        },
      });

      setStripeConnectInstance(instance);
      setStep('stripe');
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Erreur lors du chargement');
      setStep('error');
    }
  };

  const handlePreOnboardingComplete = async () => {
    await initStripe();
  };

  const handleOnboardingExit = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-account-status`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({}),
          }
        );
      }
    } catch {}

    if (mode === 'edit') {
      router.replace('/wallet/manage');
    } else {
      router.replace('/wallet');
    }
  };

  if (step === 'checking') {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="warning-outline" size={48} color="#D97706" />
        <Text style={styles.errorTitle}>Erreur</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/wallet')}>
          <Text style={styles.retryBtnText}>Retour au portefeuille</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => step === 'stripe' ? setShowExitModal(true) : router.replace('/wallet')}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back-outline" size={22} color="#1C1C18" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Modifier mes informations' : 'Active tes virements'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <Modal
        visible={showExitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="time-outline" size={28} color={Colors.primaryDark} />
            </View>
            <Text style={styles.modalTitle}>Reprendre plus tard ?</Text>
            <Text style={styles.modalText}>
              Ta progression est sauvegardée. Tu pourras reprendre à tout moment depuis ton portefeuille.
            </Text>
            <TouchableOpacity
              style={styles.modalBtnSecondary}
              onPress={() => setShowExitModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnSecondaryText}>Continuer la vérification</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnPrimary}
              onPress={() => {
                setShowExitModal(false);
                if (mode === 'edit') {
                  router.replace('/wallet/manage');
                } else {
                  router.replace('/wallet');
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalBtnPrimaryText}>Quitter et reprendre plus tard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.scrollOuter}>
        <View style={styles.contentWrapper}>

          {step === 'pre-onboarding' && userId && (
            <>
              <View style={styles.reassureCard}>
                <View style={styles.reassureIconWrap}>
                  <Ionicons name="person-circle-outline" size={22} color={Colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reassureTitle}>Tu ne crées pas une entreprise</Text>
                  <Text style={styles.reassureSubtitle}>
                    Pour recevoir tes gains, Stripe doit vérifier ton identité. C'est une obligation réglementaire, même pour les particuliers. LoueTonBien ne voit jamais tes données bancaires.
                  </Text>
                </View>
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
                onComplete={handlePreOnboardingComplete}
              />

              <View style={styles.footerInfo}>
                <Ionicons name="lock-closed-outline" size={14} color="#9B9B9B" />
                <Text style={styles.footerText}>
                  Connexion chiffrée · Données hébergées en Europe
                </Text>
              </View>
            </>
          )}

          {step === 'stripe' && (
            <>
              <View style={styles.infoCard}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#8E9878" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>
                    {mode === 'edit' ? 'Mise à jour sécurisée' : 'Vérifie ton identité pour recevoir tes gains'}
                  </Text>
                  <Text style={styles.infoSubtitle}>
                    Stripe peut utiliser un vocabulaire professionnel même pour les particuliers — c'est normal. Tu n'as rien à déclarer en tant qu'entreprise.
                  </Text>
                </View>
              </View>

              <View style={styles.stripeCard}>
                {stripeConnectInstance && (
                  <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                    <ConnectAccountOnboarding
                      onExit={handleOnboardingExit}
                    />
                  </ConnectComponentsProvider>
                )}
                {!stripeConnectInstance && (
                  <View style={styles.stripeLoading}>
                    <ActivityIndicator size="large" color={Colors.primaryDark} />
                    <Text style={styles.loadingText}>Chargement du formulaire Stripe...</Text>
                  </View>
                )}
              </View>

              <View style={styles.footerInfo}>
                <Ionicons name="lock-closed-outline" size={14} color="#9B9B9B" />
                <Text style={styles.footerText}>
                  Connexion chiffrée de bout en bout · Données hébergées en Europe
                </Text>
              </View>
            </>
          )}

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E5D8',
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySurface,
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  scrollOuter: {
    flex: 1,
    ...(Platform.OS === 'web' ? { overflow: 'auto' as any } : {}),
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 20,
  },
  reassureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#EEF3E8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D4E0C4',
  },
  reassureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reassureTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  reassureSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#4A5E38',
    lineHeight: 19,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: Colors.primarySurface,
    borderRadius: 16,
    padding: 16,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#2C2C2C',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 19,
  },
  stripeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
    } as any : {}),
    borderWidth: 0.5,
    borderColor: '#E8E5D8',
    minHeight: 400,
  },
  stripeLoading: {
    flex: 1,
    minHeight: 350,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#9B9B9B',
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#6B6B6B',
    marginTop: 16,
  },
  errorTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 24,
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 32,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 40px rgba(0,0,0,0.18)' } as any : {}),
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  modalBtnSecondary: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalBtnSecondaryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  modalBtnPrimary: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D9D5C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
});
