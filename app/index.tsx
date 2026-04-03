import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useResponsive } from '@/hooks/useResponsive';
import { InfinityHero } from '@/components/landing/InfinityHero';

const FLOATING_ICONS = [
  { icon: 'bicycle-outline',         top: '10%', left: '5%',  delay: 0,   size: 24, rotate: '-8deg' },
  { icon: 'camera-outline',          top: '7%',  left: '68%', delay: 200, size: 22, rotate: '6deg'  },
  { icon: 'musical-note-outline',    top: '26%', left: '84%', delay: 450, size: 20, rotate: '10deg' },
  { icon: 'hammer-outline',          top: '55%', left: '82%', delay: 150, size: 22, rotate: '-5deg' },
  { icon: 'game-controller-outline', top: '68%', left: '4%',  delay: 380, size: 24, rotate: '4deg'  },
  { icon: 'shirt-outline',           top: '46%', left: '87%', delay: 620, size: 20, rotate: '8deg'  },
  { icon: 'football-outline',        top: '80%', left: '70%', delay: 280, size: 20, rotate: '-6deg' },
  { icon: 'tv-outline',              top: '20%', left: '4%',  delay: 520, size: 20, rotate: '5deg'  },
  { icon: 'car-outline',             top: '36%', left: '2%',  delay: 100, size: 22, rotate: '-4deg' },
] as const;

function FloatingIcon({ icon, top, left, delay, size, rotate }: typeof FLOATING_ICONS[number]) {
  const appear = useRef(new Animated.Value(0)).current;
  const floatY  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 550,
      delay,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: true,
    }).start();

    const dur = 2600 + Math.random() * 1200;
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const ty = floatY.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <Animated.View
      style={[
        styles.floatingIcon,
        {
          top, left,
          opacity: appear,
          transform: [{ scale: appear }, { translateY: ty }, { rotate: rotate }],
        },
      ]}
    >
      <Ionicons name={icon as any} size={size} color={Colors.primaryDark} />
    </Animated.View>
  );
}

export default function LandingScreen() {
  const { isMobile } = useResponsive();
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('stripe_return') === '1') window.close();
    }
  }, []);

  const a0 = useRef(new Animated.Value(0)).current;
  const s0 = useRef(new Animated.Value(0.85)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const s1 = useRef(new Animated.Value(0.78)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const y2 = useRef(new Animated.Value(20)).current;
  const a3 = useRef(new Animated.Value(0)).current;
  const y3 = useRef(new Animated.Value(16)).current;
  const a4 = useRef(new Animated.Value(0)).current;
  const y4 = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(a0, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(s0, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(a1, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(s1, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(a2, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(y2, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(a3, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(y3, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(a4, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(y4, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const heroSize = isMobile ? Math.min(width * 0.65, 260) : Math.min(width * 0.28, 340);

  return (
    <View style={styles.root}>
      {FLOATING_ICONS.map((item) => (
        <FloatingIcon key={item.icon} {...item} />
      ))}

      <View style={[styles.layout, !isMobile && styles.layoutDesktop]}>
        <Animated.Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={[styles.logo, { opacity: a0, transform: [{ scale: s0 }] }]}
          resizeMode="contain"
        />

        <Animated.View style={{ opacity: a1, transform: [{ scale: s1 }] }}>
          <InfinityHero size={heroSize} />
        </Animated.View>

        <Animated.View style={[styles.titleWrap, { opacity: a2, transform: [{ translateY: y2 }] }]}>
          <Text style={[styles.title, !isMobile && styles.titleDesktop]}>
            Tout ce dont vous avez{'\n'}besoin,{' '}
            <Text style={styles.titleAccent}>autour de vous.</Text>
          </Text>
        </Animated.View>

        <Animated.View style={[styles.subWrap, { opacity: a3, transform: [{ translateY: y3 }] }]}>
          <Text style={styles.sub}>
            Louez, prêtez et partagez des objets{'\n'}avec vos voisins en toute confiance.
          </Text>
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View style={[styles.cta, { opacity: a4, transform: [{ translateY: y4 }] }, !isMobile && styles.ctaDesktop]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/register')} activeOpacity={0.82}>
            <Text style={styles.primaryBtnText}>Commencer gratuitement</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7} style={styles.loginRow}>
            <Text style={styles.loginText}>Déjà un compte ?</Text>
            <Text style={styles.loginLink}> Se connecter</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/legal')} activeOpacity={0.7}>
            <Text style={styles.legal}>Mentions légales · CGU · Confidentialité</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },

  floatingIcon: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.07)' } as any,
    }),
  },

  layout: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 56 : 64,
    paddingHorizontal: 28,
    paddingBottom: 32,
    gap: 10,
  },
  layoutDesktop: {
    justifyContent: 'center',
    paddingTop: 40,
    gap: 16,
  },

  logo: {
    width: 180,
    height: 42,
    marginBottom: 4,
  },

  titleWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  titleDesktop: {
    fontSize: 42,
    lineHeight: 52,
  },
  titleAccent: {
    color: Colors.primaryDark,
  },

  subWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  sub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  spacer: {
    flex: 1,
  },

  cta: {
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  ctaDesktop: {
    maxWidth: 400,
    marginTop: 16,
  },

  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primaryDark,
    height: 58,
    borderRadius: 16,
    paddingHorizontal: 24,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 5 },
      web: { boxShadow: `0 4px 18px ${Colors.primaryDark}55` } as any,
    }),
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.white,
    letterSpacing: 0.2,
  },

  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  loginText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.primaryDark,
  },

  legal: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
});
