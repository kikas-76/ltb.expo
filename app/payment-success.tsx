import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';


export default function PaymentSuccessScreen() {
  const { booking_id, session_id } = useLocalSearchParams<{ booking_id: string; session_id: string }>();
  const insets = useSafeAreaInsets();

  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (booking_id && session_id) {
      supabase
        .from('bookings')
        .update({ status: 'active', stripe_checkout_session_id: session_id })
        .eq('id', booking_id)
        .in('status', ['pending_payment', 'accepted', 'pending'])
        .then(() => {});
    }
  }, [booking_id, session_id]);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Ionicons name="checkmark-circle-outline" size={64} color={Colors.primaryDark} />
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.title}>Paiement confirmé !</Text>
          <Text style={styles.subtitle}>
            Votre réservation est maintenant active. Vous pouvez retrouver les détails dans vos messages.
          </Text>

          <View style={styles.depositNote}>
            <Text style={styles.depositNoteText}>
              La caution a été bloquée sur votre carte — elle sera automatiquement libérée après le retour de l'objet.
            </Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, { opacity: opacityAnim }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/(tabs)/reservations' as any)}
          activeOpacity={0.88}
        >
          <Ionicons name="calendar-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Voir mes réservations</Text>
          <Ionicons name="chevron-forward-outline" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)' as any)}
          activeOpacity={0.75}
        >
          <Text style={styles.secondaryBtnText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#C8D8C2',
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 6 },
      web: { boxShadow: '0 8px 32px rgba(27,67,50,0.2)' },
    }),
  },
  textBlock: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  depositNote: {
    backgroundColor: '#FFF8ED',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0D898',
    marginTop: 4,
  },
  depositNoteText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 19,
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(27,67,50,0.35)' },
    }),
  },
  primaryBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 999,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E4D8',
  },
  secondaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
