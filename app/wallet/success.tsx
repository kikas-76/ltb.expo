import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const DARK_GREEN = '#1B4332';
const LIGHT_BEIGE = '#F5F0E8';

export default function WalletSuccessScreen() {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();

    const syncAccountStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

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
      } catch (err) {
        console.error('check-account-status error:', err);
      }
    };

    syncAccountStatus();
  }, []);

  const benefits = [
    'Paiements sécurisés par Stripe',
    'Virements automatiques tous les 7 jours',
    'Tu reçois 92% du montant de chaque location',
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark-outline" size={40} color="#FFFFFF" />
        </Animated.View>

        <Text style={styles.title}>Compte activé !</Text>
        <Text style={styles.subtitle}>
          Tu peux maintenant recevoir des paiements sur LoueTonBien.
        </Text>

        <View style={styles.card}>
          {benefits.map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <View style={styles.checkDot}>
                <Ionicons name="checkmark-outline" size={12} color={DARK_GREEN} />
              </View>
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={() => router.replace('/wallet')}
        >
          <Text style={styles.primaryBtnText}>Retour au portefeuille</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LIGHT_BEIGE,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 0,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DARK_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: DARK_GREEN, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16 },
      android: { elevation: 8 },
      web: { boxShadow: '0 6px 24px rgba(27,67,50,0.35)' },
    }),
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 390,
    gap: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
    }),
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#2C2C2C',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  primaryBtn: {
    backgroundColor: DARK_GREEN,
    borderRadius: 999,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: DARK_GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(27,67,50,0.3)' },
    }),
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
