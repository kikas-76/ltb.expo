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

const FLOATING_ITEMS = [
  { icon: 'bicycle-outline',      top: '12%', left: '6%',   delay: 0,    size: 28 },
  { icon: 'camera-outline',       top: '8%',  left: '62%',  delay: 300,  size: 26 },
  { icon: 'musical-notes-outline',top: '22%', left: '82%',  delay: 600,  size: 24 },
  { icon: 'hammer-outline',       top: '62%', left: '80%',  delay: 200,  size: 26 },
  { icon: 'game-controller-outline', top: '72%', left: '5%', delay: 500, size: 28 },
  { icon: 'shirt-outline',        top: '54%', left: '88%',  delay: 800,  size: 22 },
  { icon: 'football-outline',     top: '82%', left: '72%',  delay: 400,  size: 24 },
  { icon: 'tv-outline',           top: '16%', left: '20%',  delay: 700,  size: 22 },
  { icon: 'car-outline',          top: '38%', left: '3%',   delay: 150,  size: 24 },
  { icon: 'cube-outline',         top: '88%', left: '25%',  delay: 650,  size: 20 },
] as const;

function FloatingIcon({ icon, top, left, delay, size }: typeof FLOATING_ITEMS[number]) {
  const anim = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      delay,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();

    const randomDuration = 2800 + Math.random() * 1400;
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: 1, duration: randomDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: randomDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = floatY.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });

  return (
    <Animated.View
      style={[
        styles.floatingIcon,
        { top, left, opacity: anim, transform: [{ scale: anim }, { translateY }] },
      ]}
    >
      <Ionicons name={icon as any} size={size} color={Colors.primaryDark} />
    </Animated.View>
  );
}

export default function LandingScreen() {
  const { isMobile } = useResponsive();
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('stripe_return') === '1') window.close();
    }
  }, []);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.72)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(24)).current;
  const subAnim = useRef(new Animated.Value(0)).current;
  const subY = useRef(new Animated.Value(16)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(heroAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(heroScale, { toValue: 1, tension: 42, friction: 7, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleAnim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(subAnim, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(subY, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ctaAnim, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(ctaY, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const heroSize = isMobile ? Math.min(width * 0.7, 290) : Math.min(width * 0.3, 380);

  if (!isMobile) {
    return (
      <View style={styles.root}>
        {FLOATING_ITEMS.map((item) => (
          <FloatingIcon key={item.icon} {...item} />
        ))}

        <View style={styles.desktopLayout}>
          <View style={styles.desktopTop}>
            <Animated.Image
              source={require('@/assets/images/logoLTBwhitoutbaground.png')}
              style={[styles.logoDesktop, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}
              resizeMode="contain"
            />
          </View>

          <Animated.View style={[styles.heroWrap, { opacity: heroAnim, transform: [{ scale: heroScale }] }]}>
            <InfinityHero size={heroSize} />
          </Animated.View>

          <Animated.View style={[styles.titleBlock, { opacity: titleAnim, transform: [{ translateY: titleY }] }]}>
            <Text style={styles.titleDesktop}>
              L'échange infini{'\n'}
              <Text style={styles.titleAccent}>commence ici</Text>
            </Text>
          </Animated.View>

          <Animated.View style={[styles.subBlock, { opacity: subAnim, transform: [{ translateY: subY }] }]}>
            <Text style={styles.subtitle}>
              Louez, empruntez, partagez avec vos voisins.{'\n'}
              <Text style={styles.subtitleAccent}>Une communauté infinie de possibilités.</Text>
            </Text>
          </Animated.View>

          <Animated.View style={[styles.ctaWrap, { opacity: ctaAnim, transform: [{ translateY: ctaY }] }]}>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/register')} activeOpacity={0.82}>
              <Ionicons name="sparkles-outline" size={18} color={Colors.primaryDark} />
              <Text style={styles.ctaBtnText}>Commencer l'aventure</Text>
              <Ionicons name="arrow-forward" size={17} color={Colors.primaryDark} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7} style={styles.loginRow}>
              <Text style={styles.loginText}>Déjà un compte ? </Text>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={() => router.push('/legal')} activeOpacity={0.7} style={styles.legalRow}>
            <Text style={styles.legalLink}>Mentions légales · CGU · Confidentialité</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {FLOATING_ITEMS.map((item) => (
        <FloatingIcon key={item.icon} {...item} />
      ))}

      <View style={styles.mobileLayout}>
        <Animated.Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={[styles.logoMobile, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />

        <Animated.View style={[styles.heroWrap, { opacity: heroAnim, transform: [{ scale: heroScale }] }]}>
          <InfinityHero size={heroSize} />
        </Animated.View>

        <Animated.View style={[styles.titleBlock, { opacity: titleAnim, transform: [{ translateY: titleY }] }]}>
          <Text style={styles.titleMobile}>
            L'échange infini{'\n'}
            <Text style={styles.titleAccent}>commence ici</Text>
          </Text>
        </Animated.View>

        <Animated.View style={[styles.subBlock, { opacity: subAnim, transform: [{ translateY: subY }] }]}>
          <Text style={styles.subtitle}>
            Louez, empruntez, partagez avec vos voisins.{'\n'}
            <Text style={styles.subtitleAccent}>Une communauté infinie de possibilités.</Text>
          </Text>
        </Animated.View>

        <View style={styles.bottomFixed}>
          <Animated.View style={[{ opacity: ctaAnim, transform: [{ translateY: ctaY }] }]}>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/register')} activeOpacity={0.82}>
              <Ionicons name="sparkles-outline" size={18} color={Colors.primaryDark} />
              <Text style={styles.ctaBtnText}>Commencer l'aventure</Text>
              <Ionicons name="arrow-forward" size={17} color={Colors.primaryDark} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7} style={styles.loginRow}>
              <Text style={styles.loginText}>Déjà un compte ? </Text>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/legal')} activeOpacity={0.7} style={styles.legalRow}>
              <Text style={styles.legalLink}>Mentions légales · CGU · Confidentialité</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
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
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 3px 12px rgba(0,0,0,0.08)' },
    }),
  },

  desktopLayout: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 40,
    gap: 18,
  },
  desktopTop: {
    alignItems: 'center',
  },

  mobileLayout: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 54 : 60,
    paddingHorizontal: 24,
    paddingBottom: 160,
    gap: 12,
  },

  logoDesktop: {
    width: 240,
    height: 56,
  },
  logoMobile: {
    width: 200,
    height: 46,
  },

  heroWrap: {
    alignSelf: 'center',
  },

  titleBlock: {
    alignItems: 'center',
  },
  titleDesktop: {
    fontFamily: 'Inter-Bold',
    fontSize: 46,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 56,
    letterSpacing: -1,
  },
  titleMobile: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  titleAccent: {
    color: Colors.primaryDark,
  },

  subBlock: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },
  subtitleAccent: {
    fontFamily: 'Inter-Medium',
    color: Colors.primaryDark,
  },

  ctaWrap: {
    width: '100%',
    maxWidth: 440,
    gap: 10,
    marginTop: 8,
  },

  bottomFixed: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 28,
    left: 20,
    right: 20,
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    height: 60,
    borderRadius: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 14 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
    }),
  },
  ctaBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },

  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loginText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.primaryDark,
    textDecorationLine: 'underline',
  },

  legalRow: {
    alignItems: 'center',
    paddingTop: 2,
  },
  legalLink: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
