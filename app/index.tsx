import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { InfinityHero } from '@/components/landing/InfinityHero';

export default function LandingScreen() {
  const { isMobile } = useResponsive();
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('stripe_return') === '1') {
        window.close();
      }
    }
  }, []);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.78)).current;
  const tagAnim = useRef(new Animated.Value(0)).current;
  const tagTranslate = useRef(new Animated.Value(20)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(30)).current;
  const badge1Anim = useRef(new Animated.Value(0)).current;
  const badge1Scale = useRef(new Animated.Value(0.6)).current;
  const badge2Anim = useRef(new Animated.Value(0)).current;
  const badge2Scale = useRef(new Animated.Value(0.6)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(heroAnim, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(heroScale, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(tagAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tagTranslate, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(badge1Anim, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
        Animated.spring(badge1Scale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(badge2Anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
        Animated.spring(badge2Scale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.timing(ctaAnim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(ctaTranslate, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  const heroSize = isMobile ? Math.min(width * 0.82, 320) : 420;

  const ctaBlock = (
    <Animated.View style={[styles.ctaBlock, { opacity: ctaAnim, transform: [{ translateY: ctaTranslate }] }]}>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/register')} activeOpacity={0.82}>
        <Text style={styles.primaryBtnText}>Commencer gratuitement</Text>
        <View style={styles.primaryBtnArrow}>
          <Ionicons name="arrow-forward" size={16} color={Colors.primaryDark} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7} style={styles.loginRow}>
        <Text style={styles.loginText}>Déjà un compte ? </Text>
        <Text style={styles.loginLink}>Se connecter</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/legal')} activeOpacity={0.7} style={styles.legalRow}>
        <Text style={styles.legalLink}>Mentions légales · CGU · Confidentialité</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  if (!isMobile) {
    return (
      <View style={styles.rootDesktop}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

        <View style={styles.blobTopRight} />
        <View style={styles.blobBottomLeft} />
        <View style={styles.blobCenter} />

        <View style={styles.desktopLayout}>
          <View style={styles.desktopLeft}>
            <Animated.Image
              source={require('@/assets/images/logoLTBwhitoutbaground.png')}
              style={[styles.logoDesktop, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}
              resizeMode="contain"
            />

            <Animated.View style={{ opacity: tagAnim, transform: [{ translateY: tagTranslate }] }}>
              <View style={styles.taglineRow}>
                <View style={styles.infinitySymbol}>
                  <Text style={styles.infinityChar}>∞</Text>
                </View>
                <Text style={styles.taglineText}>La location en cycle infini</Text>
              </View>

              <Text style={styles.heroTitleDesktop}>
                Tout louer.{'\n'}
                <Text style={styles.heroAccent}>Partout.</Text>{'\n'}
                <Text style={styles.heroAccent2}>Toujours.</Text>
              </Text>

              <Text style={styles.heroSubDesktop}>
                Objets du quotidien, équipements pro ou rarretés introuvables — connecte-toi à une communauté de voisins qui partagent sans limites.
              </Text>
            </Animated.View>

            <View style={styles.statsRow}>
              <Animated.View style={[styles.statPill, { opacity: badge1Anim, transform: [{ scale: badge1Scale }] }]}>
                <Ionicons name="people" size={15} color={Colors.primaryDark} />
                <Text style={styles.statValue}>+12k</Text>
                <Text style={styles.statLabel}>voisins actifs</Text>
              </Animated.View>
              <View style={styles.statSep} />
              <Animated.View style={[styles.statPill, { opacity: badge2Anim, transform: [{ scale: badge2Scale }] }]}>
                <Ionicons name="star" size={15} color={Colors.primaryDark} />
                <Text style={styles.statValue}>4.8</Text>
                <Text style={styles.statLabel}>note moyenne</Text>
              </Animated.View>
              <View style={styles.statSep} />
              <Animated.View style={[styles.statPill, { opacity: badge2Anim, transform: [{ scale: badge2Scale }] }]}>
                <Ionicons name="cube-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.statValue}>+3k</Text>
                <Text style={styles.statLabel}>objets disponibles</Text>
              </Animated.View>
            </View>

            <View style={styles.ctaCardDesktop}>
              {ctaBlock}
            </View>
          </View>

          <View style={styles.desktopRight}>
            <Animated.View style={[styles.heroWrap, { opacity: heroAnim, transform: [{ scale: heroScale }, { translateY: floatY }] }]}>
              <InfinityHero size={heroSize} />
            </Animated.View>

            <View style={styles.pillsAroundHero}>
              <View style={[styles.floatingPill, styles.pillTL]}>
                <Text style={styles.floatingPillEmoji}>🔧</Text>
                <Text style={styles.floatingPillText}>Bricolage</Text>
              </View>
              <View style={[styles.floatingPill, styles.pillTR]}>
                <Text style={styles.floatingPillEmoji}>📸</Text>
                <Text style={styles.floatingPillText}>Photo</Text>
              </View>
              <View style={[styles.floatingPill, styles.pillBL]}>
                <Text style={styles.floatingPillEmoji}>🚴</Text>
                <Text style={styles.floatingPillText}>Sport</Text>
              </View>
              <View style={[styles.floatingPill, styles.pillBR]}>
                <Text style={styles.floatingPillEmoji}>🎉</Text>
                <Text style={styles.floatingPillText}>Événementiel</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rootMobile}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.blobMobileTop} />
      <View style={styles.blobMobileBottom} />

      <View style={styles.mobileLayout}>
        <Animated.Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={[styles.logoMobile, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />

        <Animated.View style={[styles.heroWrap, { opacity: heroAnim, transform: [{ scale: heroScale }, { translateY: floatY }] }]}>
          <InfinityHero size={heroSize} />

          <Animated.View style={[styles.badgeMobile, styles.badgeMobileLeft, { opacity: badge1Anim, transform: [{ scale: badge1Scale }] }]}>
            <Ionicons name="people" size={12} color={Colors.primaryDark} />
            <Text style={styles.badgeMobileText}>+12k actifs</Text>
          </Animated.View>
          <Animated.View style={[styles.badgeMobile, styles.badgeMobileRight, { opacity: badge2Anim, transform: [{ scale: badge2Scale }] }]}>
            <Ionicons name="star" size={12} color={Colors.primaryDark} />
            <Text style={styles.badgeMobileText}>4.8 / 5</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.mobileTextBlock, { opacity: tagAnim, transform: [{ translateY: tagTranslate }] }]}>
          <View style={styles.taglineRow}>
            <View style={styles.infinitySymbol}>
              <Text style={styles.infinityChar}>∞</Text>
            </View>
            <Text style={styles.taglineText}>La location en cycle infini</Text>
          </View>
          <Text style={styles.heroTitleMobile}>
            Tout louer.{' '}
            <Text style={styles.heroAccent}>Partout.</Text>{' '}
            <Text style={styles.heroAccent2}>Toujours.</Text>
          </Text>
          <Text style={styles.heroSubMobile}>
            Des milliers d'objets disponibles autour de toi, partagés par tes voisins.
          </Text>
        </Animated.View>

        {ctaBlock}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootMobile: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  rootDesktop: {
    flex: 1,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },

  blobTopRight: {
    position: 'absolute',
    top: -160,
    right: -160,
    width: 480,
    height: 480,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    opacity: 0.08,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -180,
    left: -140,
    width: 520,
    height: 520,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    opacity: 0.06,
  },
  blobCenter: {
    position: 'absolute',
    top: '30%',
    left: '35%',
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight,
    opacity: 0.1,
  },
  blobMobileTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    opacity: 0.08,
  },
  blobMobileBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    opacity: 0.06,
  },

  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 60,
    paddingVertical: 40,
    gap: 48,
  },
  desktopLeft: {
    flex: 52,
    justifyContent: 'center',
    gap: 24,
  },
  desktopRight: {
    flex: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  logoDesktop: {
    width: 260,
    height: 64,
  },
  logoMobile: {
    width: '72%',
    height: 52,
    alignSelf: 'center',
    marginBottom: 4,
  },

  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  infinitySymbol: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infinityChar: {
    fontSize: 20,
    color: Colors.white,
    fontFamily: 'Inter-Bold',
    lineHeight: 24,
  },
  taglineText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.primaryDark,
    letterSpacing: 0.3,
  },

  heroTitleDesktop: {
    fontFamily: 'Inter-Bold',
    fontSize: 52,
    color: Colors.text,
    lineHeight: 62,
    letterSpacing: -1.2,
    marginBottom: 16,
  },
  heroTitleMobile: {
    fontFamily: 'Inter-Bold',
    fontSize: 30,
    color: Colors.text,
    lineHeight: 38,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  heroAccent: {
    color: Colors.primaryDark,
  },
  heroAccent2: {
    color: Colors.primary,
    fontFamily: 'Inter-Bold',
  },

  heroSubDesktop: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 25,
    maxWidth: 420,
  },
  heroSubMobile: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 0,
    ...Platform.select({
      web: { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' },
    }),
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statSep: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },

  heroWrap: {
    alignSelf: 'center',
    position: 'relative',
  },

  pillsAroundHero: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    pointerEvents: 'none',
  },
  floatingPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(0,0,0,0.08)' },
    }),
  },
  floatingPillEmoji: {
    fontSize: 16,
  },
  floatingPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  pillTL: { top: '12%', left: '-5%' },
  pillTR: { top: '8%', right: '-5%' },
  pillBL: { bottom: '14%', left: '-8%' },
  pillBR: { bottom: '10%', right: '-8%' },

  mobileLayout: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 52 : 58,
    paddingHorizontal: 22,
    paddingBottom: 28,
    gap: 0,
  },

  mobileTextBlock: {
    marginBottom: 8,
  },

  badgeMobile: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.white,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.08)' },
    }),
  },
  badgeMobileText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  badgeMobileLeft: {
    top: '42%',
    left: -10,
  },
  badgeMobileRight: {
    top: '42%',
    right: -10,
  },

  ctaCardDesktop: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      web: { boxShadow: '0 6px 28px rgba(0,0,0,0.07)' },
    }),
  },

  ctaBlock: {
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryDark,
    height: 58,
    borderRadius: 16,
    paddingLeft: 22,
    paddingRight: 12,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.28, shadowRadius: 14 },
      android: { elevation: 5 },
      web: { boxShadow: '0 5px 20px rgba(142,152,120,0.4)' },
    }),
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  primaryBtnArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
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
