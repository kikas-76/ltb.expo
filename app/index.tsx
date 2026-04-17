import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  ScrollView,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { InfinityHero } from '@/components/landing/InfinityHero';
import { PRELAUNCH_MODE } from '@/lib/launchConfig';

/*
  Floating icons are rendered INSIDE the flex column so they don't
  interfere with the scroll. They sit in an absolutely-positioned
  overlay View that is pointer-events:none, sized to match the screen.
*/

// Each icon uses a tint that matches its category strip on the home page,
// so the landing visually previews the marketplace's diversity. Sizes vary
// (16–28) to create a richer constellation rather than a uniform grid.
const FLOATING_ICONS = [
  // top band
  { icon: 'bicycle-outline',         topPct: 0.07,  leftPct: 0.04, delay: 0,    size: 24, rotate: '-8deg', color: '#3A8C6A' },
  { icon: 'tv-outline',              topPct: 0.16,  leftPct: 0.02, delay: 520,  size: 18, rotate: '5deg',  color: '#4A7EC7' },
  { icon: 'sparkles-outline',        topPct: 0.04,  leftPct: 0.45, delay: 350,  size: 16, rotate: '-3deg', color: '#C050A0' },
  { icon: 'camera-outline',          topPct: 0.05,  leftPct: 0.72, delay: 200,  size: 22, rotate: '6deg',  color: '#4A7EC7' },
  { icon: 'musical-notes-outline',   topPct: 0.20,  leftPct: 0.88, delay: 450,  size: 20, rotate: '10deg', color: '#C04070' },
  // mid band (kept away from the central title/cta column)
  { icon: 'car-outline',             topPct: 0.34,  leftPct: 0.02, delay: 100,  size: 22, rotate: '-4deg', color: '#3A8C6A' },
  { icon: 'shirt-outline',           topPct: 0.42,  leftPct: 0.90, delay: 620,  size: 18, rotate: '8deg',  color: '#B85050' },
  { icon: 'happy-outline',           topPct: 0.50,  leftPct: 0.04, delay: 280,  size: 20, rotate: '5deg',  color: '#8050B8' },
  { icon: 'restaurant-outline',      topPct: 0.52,  leftPct: 0.86, delay: 150,  size: 20, rotate: '-5deg', color: '#C08030' },
  // lower band
  { icon: 'compass-outline',         topPct: 0.62,  leftPct: 0.06, delay: 700,  size: 22, rotate: '-7deg', color: '#5A9040' },
  { icon: 'game-controller-outline', topPct: 0.66,  leftPct: 0.03, delay: 380,  size: 22, rotate: '4deg',  color: '#4A5EC7' },
  { icon: 'construct-outline',       topPct: 0.70,  leftPct: 0.86, delay: 240,  size: 22, rotate: '7deg',  color: '#4A8C4A' },
  { icon: 'football-outline',        topPct: 0.78,  leftPct: 0.72, delay: 280,  size: 18, rotate: '-6deg', color: '#C07840' },
  { icon: 'home-outline',            topPct: 0.82,  leftPct: 0.06, delay: 540,  size: 18, rotate: '4deg',  color: '#A07830' },
  { icon: 'briefcase-outline',       topPct: 0.88,  leftPct: 0.88, delay: 460,  size: 16, rotate: '-3deg', color: '#8A6A50' },
  { icon: 'flame-outline',           topPct: 0.92,  leftPct: 0.42, delay: 800,  size: 16, rotate: '6deg',  color: '#C07840' },
] as const;

function FloatingIcons({ width, height }: { width: number; height: number }) {
  return (
    <View
      style={[styles.floatingLayer, { width, height }]}
      pointerEvents="none"
    >
      {FLOATING_ICONS.map((item) => (
        <SingleFloatingIcon key={item.icon} {...item} containerWidth={width} containerHeight={height} />
      ))}
    </View>
  );
}

function SingleFloatingIcon({
  icon, topPct, leftPct, delay, size, rotate, color, containerWidth, containerHeight,
}: typeof FLOATING_ICONS[number] & { containerWidth: number; containerHeight: number }) {
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

  const ICON_BOX = 44;
  const top  = containerHeight * topPct;
  const left = containerWidth  * leftPct;

  return (
    <Animated.View
      style={[
        styles.floatingIcon,
        {
          top:    Math.max(8, Math.min(top,  containerHeight - ICON_BOX - 8)),
          left:   Math.max(4, Math.min(left, containerWidth  - ICON_BOX - 4)),
          opacity: appear,
          transform: [{ scale: appear }, { translateY: ty }, { rotate: rotate }],
        },
      ]}
    >
      <Ionicons name={icon as any} size={size} color={color} />
    </Animated.View>
  );
}

export default function LandingScreen() {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('stripe_return') === '1') {
        router.replace('/wallet');
        return;
      }
    }
  }, []);

  const a0 = useRef(new Animated.Value(0)).current;
  const s0 = useRef(new Animated.Value(0.88)).current;
  const a1 = useRef(new Animated.Value(0)).current;
  const s1 = useRef(new Animated.Value(0.80)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const y2 = useRef(new Animated.Value(18)).current;
  const a3 = useRef(new Animated.Value(0)).current;
  const y3 = useRef(new Animated.Value(14)).current;
  const a4 = useRef(new Animated.Value(0)).current;
  const y4 = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(a0, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(s0, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(a1, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(s1, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(a2, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(y2, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(a3, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(y3, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(a4, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(y4, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const isNarrow = width < 480;
  const isTall   = height > 700;
  const heroSize = Math.min(width * (isNarrow ? 0.58 : 0.35), isTall ? 240 : 200);
  const maxContentWidth = Math.min(width, 480);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        <FloatingIcons width={width} height={height} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { minHeight: height },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.inner, { maxWidth: maxContentWidth, width: '100%' }]}>
            <View style={styles.topSection}>
              <Animated.Image
                source={require('@/assets/images/logoLTBwhitoutbaground.png')}
                style={[styles.logo, { opacity: a0, transform: [{ scale: s0 }] }]}
                resizeMode="contain"
              />

              <Animated.View style={{ opacity: a1, transform: [{ scale: s1 }] }}>
                <InfinityHero size={heroSize} />
              </Animated.View>

              <Animated.View style={[styles.titleWrap, { opacity: a2, transform: [{ translateY: y2 }] }]}>
                {PRELAUNCH_MODE ? (
                  <>
                    <View style={styles.prelaunchBadge}>
                      <Ionicons name="sparkles-outline" size={13} color={Colors.primaryDark} />
                      <Text style={styles.prelaunchBadgeText}>Avant-première · dépôt d'annonces ouvert</Text>
                    </View>
                    <Text style={[styles.title, !isNarrow && styles.titleWide]}>
                      Dépose ta première annonce{' '}
                      <Text style={styles.titleAccent}>avant l'ouverture.</Text>
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.title, !isNarrow && styles.titleWide]}>
                    Tout ce dont vous avez besoin,{' '}
                    <Text style={styles.titleAccent}>autour de vous.</Text>
                  </Text>
                )}
              </Animated.View>

              <Animated.View style={[styles.subWrap, { opacity: a3, transform: [{ translateY: y3 }] }]}>
                <Text style={styles.sub}>
                  {PRELAUNCH_MODE
                    ? "Crée ton compte et publie ton annonce dès maintenant.\nLa marketplace ouvre au public très bientôt — tes annonces seront\nen ligne dès l'ouverture."
                    : 'Louez, prêtez et partagez des objets\navec vos voisins en toute confiance.'}
                </Text>
              </Animated.View>
            </View>

            <Animated.View style={[styles.ctaSection, { opacity: a4, transform: [{ translateY: y4 }] }]}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push('/register')}
                activeOpacity={0.82}
              >
                <Text style={styles.primaryBtnText}>
                  {PRELAUNCH_MODE ? 'Déposer mon annonce' : 'Commencer gratuitement'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.white} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/login')}
                activeOpacity={0.7}
                style={styles.loginRow}
              >
                <Text style={styles.loginText}>Déjà un compte ?</Text>
                <Text style={styles.loginLink}> Se connecter</Text>
              </TouchableOpacity>

              <View style={styles.trustRow}>
                <View style={styles.trustBadge}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={Colors.primaryDark} />
                  <Text style={styles.trustBadgeText}>Paiement Stripe</Text>
                </View>
                <View style={styles.trustBadge}>
                  <Ionicons name="lock-closed-outline" size={13} color={Colors.primaryDark} />
                  <Text style={styles.trustBadgeText}>Caution garantie</Text>
                </View>
                <View style={styles.trustBadge}>
                  <Ionicons name="leaf-outline" size={13} color={Colors.primaryDark} />
                  <Text style={styles.trustBadgeText}>Écoresponsable</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => router.push('/legal')} activeOpacity={0.7}>
                <Text style={styles.legal}>Mentions légales · CGU · Confidentialité</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  floatingLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
    pointerEvents: 'none' as any,
  },
  floatingIcon: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 13,
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

  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },

  inner: {
    flex: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '100%' as any,
    paddingBottom: 8,
  },

  topSection: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 24,
  },

  logo: {
    width: 170,
    height: 40,
    marginBottom: 4,
  },

  titleWrap: {
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  prelaunchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  prelaunchBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  titleWide: {
    fontSize: 32,
    lineHeight: 42,
  },
  titleAccent: {
    color: Colors.primaryDark,
  },

  subWrap: {
    alignItems: 'center',
  },
  sub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  ctaSection: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },

  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primaryDark,
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 24,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
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

  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trustBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.primaryDark,
    letterSpacing: 0.1,
  },
});
