import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function EmailConfirmedScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  const [sessionSet, setSessionSet] = useState(false);

  useEffect(() => {
    const restoreSession = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.slice(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            setSessionSet(true);
          }
        }
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(iconScale, { toValue: 1, damping: 12, stiffness: 160, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
      Animated.spring(checkScale, { toValue: 1, damping: 14, stiffness: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-open-outline" size={44} color={Colors.primaryDark} />
          </View>
          <Animated.View style={[styles.iconBadge, { transform: [{ scale: checkScale }] }]}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.title}>Email vérifié !</Text>
          <Text style={styles.subtitle}>
            Ton adresse email a bien été confirmée. Tu peux maintenant accéder à ton compte.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.actionsBlock, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
            <Text style={styles.loginBtnText}>Continuer</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.helpRow, { opacity: fadeAnim }]}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.helpText}>
            Tu seras redirigé vers la complétion de ton profil si ce n'est pas encore fait.
          </Text>
        </Animated.View>
      </View>

      <Image
        source={require('@/assets/images/logoLTBwhitoutbaground.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  content: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 32,
  },
  iconWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.successGreenLight,
    borderWidth: 2,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.successGreen, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 8 },
      web: { boxShadow: '0 8px 32px rgba(22,163,74,0.18)' },
    }),
  },
  iconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.successGreen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.background,
  },
  textBlock: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 8,
  },
  actionsBlock: {
    width: '100%',
    gap: 14,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 999,
    backgroundColor: Colors.successGreen,
    ...Platform.select({
      ios: { shadowColor: Colors.successGreen, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(22,163,74,0.3)' },
    }),
  },
  loginBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.2,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 4,
  },
  helpText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  logo: {
    position: 'absolute',
    bottom: 32,
    width: 120,
    height: 32,
    opacity: 0.4,
  },
});
