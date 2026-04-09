import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function WalletOnboardingNative() {
  useEffect(() => {
    router.replace('/wallet');
  }, []);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color="#1B4332" />
      <Text style={styles.text}>Redirection...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E8' },
  text: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#6B6B6B', marginTop: 12 },
});
