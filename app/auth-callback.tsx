import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function AuthCallbackScreen() {
  const { session, loading, profile, profileLoading } = useAuth();
  const [tokenProcessed, setTokenProcessed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setTokenProcessed(true);
      return;
    }

    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (!hash) {
      setTokenProcessed(true);
      return;
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(() => {
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
          }
          setTokenProcessed(true);
        })
        .catch(() => setTokenProcessed(true));
    } else {
      setTokenProcessed(true);
    }
  }, []);

  useEffect(() => {
    if (!tokenProcessed || loading || profileLoading) return;

    if (!session) {
      router.replace('/register');
      return;
    }

    if (!profile?.onboarding_completed) {
      router.replace('/onboarding/profile' as any);
    } else {
      router.replace('/(tabs)');
    }
  }, [tokenProcessed, session, loading, profile, profileLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
