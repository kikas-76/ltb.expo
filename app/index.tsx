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
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import InfinityLoader from '@/components/InfinityLoader';
import InfiniteIconStrip from '@/components/InfiniteIconStrip';
import { buildInfinityPath } from '@/components/landing/InfinityHero';
import { PRELAUNCH_MODE } from '@/lib/launchConfig';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Première ouverture : la page reprend le langage du splash. Le ∞ du logo se
 * trace au centre, le ruban des pictogrammes catégories défile sous la
 * promesse, et un grand ∞ en filigrane traverse le fond.
 */

function InfinityWatermark({ width }: { width: number }) {
  const w = Math.round(width * 1.7);
  const h = Math.round(w * 0.52);
  const d = buildInfinityPath(w / 2, h / 2, w / 2 - w * 0.06, 1.35);
  return (
    <View pointerEvents="none" style={[styles.watermark, { width: w, height: h, top: -h * 0.28, left: -w * 0.2 }]}>
      <Svg width={w} height={h}>
        <Path d={d} fill="none" stroke={Colors.primaryLight} strokeWidth={w * 0.075} strokeLinecap="round" strokeLinejoin="round" opacity={0.28} />
      </Svg>
    </View>
  );
}

function useReveal(delay: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

const TRUST = [
  { label: 'Paiement Stripe', dot: '#2F5C86' },
  { label: 'Caution garantie', dot: '#3E5A2B' },
  { label: 'Entre voisins', dot: '#A8562A' },
];

export default function LandingScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('stripe_return') === '1') {
        router.replace('/wallet');
      }
    }
  }, []);

  const logoReveal = useReveal(100);
  const heroReveal = useReveal(250);
  const titleReveal = useReveal(700);
  const subReveal = useReveal(900);
  const ribbonReveal = useReveal(1100);
  const ctaReveal = useReveal(1300);

  const isTall = height > 740;
  const heroSize = Math.min(Math.round(width * 0.62), isTall ? 250 : 210);
  const maxContentWidth = Math.min(width, 520);

  // Session en cours de lecture, ou utilisateur déjà connecté : on n'affiche pas la
  // page (le guard du layout redirige vers l'accueil). Évite le passage par cette
  // page à chaque réouverture de l'app.
  if (authLoading || session) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <InfinityWatermark width={width} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 20, minHeight: height },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.inner, { maxWidth: maxContentWidth }]}>
          <Animated.View style={[styles.logoWrap, logoReveal]}>
            <Image
              source={require('@/assets/images/logoLTBwhitoutbaground.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View style={[styles.heroWrap, heroReveal]}>
            <InfinityLoader size={heroSize} drawDuration={1400} />
          </Animated.View>

          <Animated.View style={[styles.titleWrap, titleReveal]}>
            {PRELAUNCH_MODE ? (
              <>
                <View style={styles.badge}>
                  <View style={styles.badgeDot} />
                  <Text style={styles.badgeText}>Avant-première · dépôt d'annonces ouvert</Text>
                </View>
                <Text style={styles.title}>
                  Dépose ta première annonce{' '}
                  <Text style={styles.titleAccent}>avant l'ouverture.</Text>
                </Text>
              </>
            ) : (
              <Text style={styles.title}>
                Tout ce dont vous avez besoin,{'\n'}
                <Text style={styles.titleAccent}>autour de vous.</Text>
              </Text>
            )}
          </Animated.View>

          <Animated.View style={[styles.subWrap, subReveal]}>
            <Text style={styles.sub}>
              {PRELAUNCH_MODE
                ? "Crée ton compte et publie ton annonce dès maintenant. La marketplace ouvre au public très bientôt."
                : 'Louez, prêtez et partagez des objets avec vos voisins, en toute confiance.'}
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.ribbonWrap, ribbonReveal]}>
          <InfiniteIconStrip />
        </Animated.View>

        <Animated.View style={[styles.inner, styles.ctaSection, { maxWidth: maxContentWidth }, ctaReveal]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              haptics.confirm();
              router.push('/register');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>
              {PRELAUNCH_MODE ? 'Déposer mon annonce' : 'Commencer gratuitement'}
            </Text>
            <View style={styles.primaryBtnArrow}>
              <Ionicons name="arrow-forward" size={16} color={Colors.primaryDark} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7} style={styles.loginRow}>
            <Text style={styles.loginText}>Déjà un compte ?</Text>
            <Text style={styles.loginLink}> Se connecter</Text>
          </TouchableOpacity>

          <View style={styles.trustRow}>
            {TRUST.map((t) => (
              <View key={t.label} style={styles.trustPill}>
                <View style={[styles.trustDot, { backgroundColor: t.dot }]} />
                <Text style={styles.trustText}>{t.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity onPress={() => router.push('/legal')} activeOpacity={0.7}>
            <Text style={styles.legal}>Mentions légales · CGU · Confidentialité</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  watermark: {
    position: 'absolute',
    transform: [{ rotate: '-14deg' }],
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inner: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 150,
    height: 40,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  titleWrap: {
    alignItems: 'center',
    marginTop: 14,
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E7E3D5',
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: Colors.text,
    textAlign: 'center',
  },
  titleAccent: {
    color: Colors.primaryDark,
  },
  subWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
  sub: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 340,
  },
  ribbonWrap: {
    width: '100%',
    marginTop: 22,
  },
  ctaSection: {
    marginTop: 18,
    gap: 14,
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    paddingVertical: 15,
    paddingLeft: 26,
    paddingRight: 8,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16 },
      android: { elevation: 6 },
      web: { boxShadow: '0 8px 16px rgba(78,107,56,0.22)' },
    }),
  },
  primaryBtnText: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.white,
    textAlign: 'center',
  },
  primaryBtnArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  trustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E7E3D5',
  },
  trustDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  trustText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  legal: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});
