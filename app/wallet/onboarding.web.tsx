import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from '@stripe/react-connect-js';

const DARK_GREEN = '#1B4332';

export default function WalletOnboardingScreen() {
  const insets = useSafeAreaInsets();
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
              fontFamily: 'Inter, system-ui, sans-serif',
              borderRadius: '12px',
              colorBackground: '#FFFFFF',
              colorText: '#2C2C2C',
              colorSecondaryText: '#6B6B6B',
              colorBorder: '#D9D5C8',
              spacingUnit: '10px',
              fontSizeBase: '15px',
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
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
            body: JSON.stringify({ access_token: session.access_token }),
          }
        );
      }
    } catch {}
    router.replace('/wallet');
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
        <Text style={styles.headerTitle}>Activer les paiements</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.stripeContainer}>
        {stripeConnectInstance && (
          <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
            <ConnectAccountOnboarding
              onExit={handleOnboardingExit}
            />
          </ConnectComponentsProvider>
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E5D8',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    color: '#1C1C18',
  },
  stripeContainer: {
    flex: 1,
    ...(Platform.OS === 'web' ? { overflow: 'auto' as any } : {}),
    padding: 16,
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
    backgroundColor: DARK_GREEN,
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
