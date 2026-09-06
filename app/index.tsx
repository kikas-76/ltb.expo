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
import { useResponsive } from '@/hooks/useResponsive';

/**
 * Page publique (web) et première ouverture (app) : la page reprend le langage
 * du splash. Le ∞ du logo se trace au centre, le ruban des pictogrammes
 * catégories défile sous la promesse, et un grand ∞ en filigrane traverse le
 * fond. Sur desktop, texte à gauche et ∞ à droite.
 */

function InfinityWatermark({ width, desktop }: { width: number; desktop: boolean }) {
  const w = Math.round(width * (desktop ? 1.05 : 1.7));
  const h = Math.round(w * 0.52);
  const d = buildInfinityPath(w / 2, h / 2, w / 2 - w * 0.06, 1.35);
  const position = desktop
    ? { top: -h * 0.22, left: width - w * 0.68 }
    : { top: -h * 0.28, left: -w * 0.2 };
  return (
    <View pointerEvents="none" style={[styles.watermark, { width: w, height: h }, position]}>
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

const TITLE = PRELAUNCH_MODE ? (
  <>
    Dépose ta première annonce{' '}
    <Text style={{ color: Colors.primaryDark }}>avant l'ouverture.</Text>
  </>
) : (
  <>
    Tout ce dont vous avez besoin,{'\n'}
    <Text style={{ color: Colors.primaryDark }}>autour de vous.</Text>
  </>
);

const SUBTITLE = PRELAUNCH_MODE
  ? "Crée ton compte et publie ton annonce dès maintenant. La marketplace ouvre au public très bientôt."
  : 'Louez, prêtez et partagez des objets avec vos voisins, en toute confiance.';

const PRIMARY_LABEL = PRELAUNCH_MODE ? 'Déposer mon annonce' : 'Commencer gratuitement';

function PrelaunchBadge({ align }: { align: 'center' | 'flex-start' }) {
  if (!PRELAUNCH_MODE) return null;
  return (
    <View style={[styles.badge, { alignSelf: align }]}>
      <View style={styles.badgeDot} />
      <Text style={styles.badgeText}>Avant-première · dépôt d'annonces ouvert</Text>
    </View>
  );
}

function TrustPills({ justify }: { justify: 'center' | 'flex-start' }) {
  return (
    <View style={[styles.trustRow, { justifyContent: justify }]}>
      {TRUST.map((t) => (
        <View key={t.label} style={styles.trustPill}>
          <View style={[styles.trustDot, { backgroundColor: t.dot }]} />
          <Text style={styles.trustText}>{t.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function LandingScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { session, loading: authLoading } = useAuth();
  const { isDesktop, isTablet } = useResponsive();

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

  const startRegister = () => {
    haptics.confirm();
    router.push('/register');
  };

  // Session en cours de lecture, ou utilisateur déjà connecté : on n'affiche pas la
  // page (le guard du layout redirige vers l'accueil).
  if (authLoading || session) {
    return <View style={styles.root} />;
  }

  // ---------------------------------------------------------------- Desktop
  if (isDesktop) {
    const heroSize = Math.round(Math.min(400, Math.max(300, width * 0.26)));
    return (
      <View style={styles.root}>
        <InfinityWatermark width={width} desktop />
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { minHeight: height, paddingTop: 28, paddingBottom: 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={desk.page}>
            <Animated.View style={[desk.topBar, logoReveal]}>
              <Image
                source={require('@/assets/images/logoLTBwhitoutbaground.png')}
                style={desk.logo}
                resizeMode="contain"
              />
              <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7} style={desk.topLogin}>
                <Text style={desk.topLoginText}>Se connecter</Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={desk.hero}>
              <View style={desk.heroText}>
                <Animated.View style={titleReveal}>
                  <PrelaunchBadge align="flex-start" />
                  <Text style={[styles.title, desk.title]}>{TITLE}</Text>
                </Animated.View>
                <Animated.View style={subReveal}>
                  <Text style={[styles.sub, desk.sub]}>{SUBTITLE}</Text>
                </Animated.View>
                <Animated.View style={[desk.ctaRow, ctaReveal]}>
                  <TouchableOpacity style={desk.primaryBtn} onPress={startRegister} activeOpacity={0.85}>
                    <Text style={desk.primaryBtnText}>{PRIMARY_LABEL}</Text>
                    <View style={styles.primaryBtnArrow}>
                      <Ionicons name="arrow-forward" size={16} color={Colors.primaryDark} />
                    </View>
                  </TouchableOpacity>
                  <Text style={desk.ctaHint}>Gratuit, sans engagement.</Text>
                </Animated.View>
                <Animated.View style={ctaReveal}>
                  <TrustPills justify="flex-start" />
                </Animated.View>
              </View>

              <Animated.View style={[desk.heroVisual, heroReveal]}>
                <View style={desk.heroCard}>
                  <InfinityLoader size={heroSize} drawDuration={1400} />
                </View>
              </Animated.View>
            </View>
          </View>

          <Animated.View style={[desk.ribbon, ribbonReveal]}>
            <InfiniteIconStrip />
          </Animated.View>

          <Animated.View style={[desk.footer, ctaReveal]}>
            <TouchableOpacity onPress={() => router.push('/legal')} activeOpacity={0.7}>
              <Text style={styles.legal}>Mentions légales · CGU · Confidentialité</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ------------------------------------------------------ Mobile et tablette
  const isTall = height > 740;
  const heroSize = isTablet
    ? Math.min(Math.round(width * 0.4), 300)
    : Math.min(Math.round(width * 0.62), isTall ? 250 : 210);
  const maxContentWidth = Math.min(width, isTablet ? 640 : 520);

  return (
    <View style={styles.root}>
      <InfinityWatermark width={width} desktop={false} />

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
            <PrelaunchBadge align="center" />
            <Text style={[styles.title, isTablet && styles.titleTablet]}>{TITLE}</Text>
          </Animated.View>

          <Animated.View style={[styles.subWrap, subReveal]}>
            <Text style={[styles.sub, isTablet && styles.subTablet]}>{SUBTITLE}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.ribbonWrap, ribbonReveal]}>
          <InfiniteIconStrip />
        </Animated.View>

        <Animated.View style={[styles.inner, styles.ctaSection, { maxWidth: maxContentWidth }, ctaReveal]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={startRegister} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{PRIMARY_LABEL}</Text>
            <View style={styles.primaryBtnArrow}>
              <Ionicons name="arrow-forward" size={16} color={Colors.primaryDark} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7} style={styles.loginRow}>
            <Text style={styles.loginText}>Déjà un compte ?</Text>
            <Text style={styles.loginLink}> Se connecter</Text>
          </TouchableOpacity>

          <TrustPills justify="center" />

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
    marginBottom: 12,
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
  titleTablet: {
    fontSize: 40,
    lineHeight: 46,
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
  subTablet: {
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 440,
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

const desk = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: 1160,
    paddingHorizontal: 56,
    flexGrow: 1,
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 168,
    height: 44,
  },
  topLogin: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E7E3D5',
  },
  topLoginText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.primaryDark,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 56,
    marginTop: 48,
    marginBottom: 40,
  },
  heroText: {
    flex: 1.15,
    gap: 22,
  },
  title: {
    fontSize: 54,
    lineHeight: 60,
    letterSpacing: -1.6,
    textAlign: 'left',
  },
  sub: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'left',
    maxWidth: 480,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 4,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    paddingVertical: 14,
    paddingLeft: 30,
    paddingRight: 8,
    ...Platform.select({
      web: { boxShadow: '0 8px 16px rgba(78,107,56,0.22)' },
      default: {},
    }),
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    color: Colors.white,
  },
  ctaHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },
  heroVisual: {
    flex: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    padding: 44,
    borderRadius: 40,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E7E3D5',
    ...Platform.select({
      web: { boxShadow: '0 24px 48px rgba(44,44,44,0.08)' },
      default: {},
    }),
  },
  ribbon: {
    width: '100%',
    marginTop: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 26,
  },
});
