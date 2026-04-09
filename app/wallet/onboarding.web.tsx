import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js';

const DARK_GREEN = '#1B4332';

export default function WalletOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [stripeConnectInstance, setStripeConnectInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError('Session expirée. Reconnecte-toi.');
          setLoading(false);
          return;
        }

        const instance = loadConnectAndInitialize({
          publishableKey,
          locale: 'fr',
          fetchClientSecret: async () => {
            const response = await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-account-session`,
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
        setLoading(false);
      } catch (err: any) {
        setError(err.message ?? 'Erreur lors du chargement');
        setLoading(false);
      }
    };

    init();
  }, []);

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

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={DARK_GREEN} />
        <Text style={styles.loadingText}>Chargement de l'inscription Stripe...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="warning-outline" size={48} color="#D97706" />
        <Text style={styles.errorTitle}>Erreur</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/wallet')}>
          <Text style={styles.retryBtnText}>Retour au portefeuille</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color="#1C1C18" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'edit' ? 'Modifier mes informations' : 'Activer les paiements'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.scrollOuter}>
        <View style={styles.contentWrapper}>
          <View style={styles.infoCard}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#8E9878" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>
                {mode === 'edit' ? 'Mise à jour sécurisée par Stripe' : 'Inscription sécurisée par Stripe'}
              </Text>
              <Text style={styles.infoSubtitle}>
                Tes données bancaires sont gérées par Stripe, leader mondial du paiement en ligne. LoueTonBien n'y a jamais accès.
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
          </View>

          <View style={styles.footerInfo}>
            <Ionicons name="lock-closed-outline" size={14} color="#9B9B9B" />
            <Text style={styles.footerText}>
              Connexion chiffrée de bout en bout · Données hébergées en Europe
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5F0E8',
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
    backgroundColor: '#F5F0E8',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEEE6',
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    color: '#1C1C18',
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
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#ECEEE6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
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
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
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
    color: '#1C1C18',
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
    backgroundColor: '#1B4332',
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
});
