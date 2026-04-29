import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { PRELAUNCH_MODE } from '@/lib/launchConfig';

async function redirectByProfile() {
  // onboarding_completed and role are not in the authenticated SELECT
  // grant on profiles (20260426202603). Read them through the
  // SECURITY DEFINER RPC, same as AuthContext.
  const { data } = await supabase.rpc('get_my_profile');
  const me = Array.isArray(data) ? data[0] : data;

  if (!me?.onboarding_completed) {
    router.replace('/onboarding/profile' as any);
  } else if (PRELAUNCH_MODE && me.role !== 'admin') {
    router.replace('/(tabs)/mes-annonces' as any);
  } else {
    router.replace('/(tabs)');
  }
}

export default function AuthCallbackScreen() {
  const processed = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/register');
      return;
    }

    const timeout = setTimeout(() => {
      if (!processed.current) {
        processed.current = true;
        router.replace('/register');
      }
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (processed.current) return;
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        processed.current = true;
        clearTimeout(timeout);
        (async () => { await redirectByProfile(); })();
      }
    });

    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const errorCode = params.get('error_code');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (errorCode) {
        processed.current = true;
        clearTimeout(timeout);
        subscription.unsubscribe();
        window.history.replaceState(null, '', window.location.pathname);
        router.replace('/register');
        return;
      }

      if (accessToken && refreshToken) {
        window.history.replaceState(null, '', window.location.pathname);
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(() => {});
        return () => { clearTimeout(timeout); subscription.unsubscribe(); };
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (processed.current) return;
      if (session) {
        processed.current = true;
        clearTimeout(timeout);
        (async () => { await redirectByProfile(); })();
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

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
