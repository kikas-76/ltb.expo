import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

export default function AuthCallbackScreen() {
  const { session, loading, profile, profileLoading } = useAuth();

  useEffect(() => {
    if (loading || profileLoading) return;

    if (!session) {
      router.replace('/register');
      return;
    }

    if (!profile?.onboarding_completed) {
      router.replace('/onboarding/profile' as any);
    } else {
      router.replace('/(tabs)');
    }
  }, [session, loading, profile, profileLoading]);

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
