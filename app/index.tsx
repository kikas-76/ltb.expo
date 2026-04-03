import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
  ScrollView,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { InfinityHero } from '@/components/landing/InfinityHero';

const VALUE_PROPS = [
  {
    icon: 'search-outline' as const,
    title: 'Trouve près de chez toi',
    description: 'Perceuses, vélos, appareils photo — des milliers d\'objets disponibles autour de toi.',
    accent: Colors.primaryDark,
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Loue en toute confiance',
    description: 'Paiement sécurisé, caution protégée et profils vérifiés.',
    accent: '#7A9E7E',
  },
  {
    icon: 'cash-outline' as const,
    title: "Rentabilise tes objets",
    description: "Fais travailler ce qui dort chez toi et génère un revenu régulier.",
    accent: Colors.primary,
  },
];

function ValueCard({ icon, title, description, accent, delay, masterAnim }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(anim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View style={[styles.valueCard, { opacity: anim, transform: [{ translateY }, { scale }] }]}>
      <View style={[styles.valueCardIcon, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon} size={24} color={accent} />
      </View>
      <View style={styles.valueCardText}>
        <Text style={styles.valueCardTitle}>{title}</Text>
        <Text style={styles.valueCardDesc}>{description}</Text>
      </View>
    </Animated.View>
  );
}

export default function LandingScreen() {
  const { signInWithGoogle } = useAuth();
  const { isMobile } = useResponsive();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('stripe_return') === '1') {
        window.close();
      }
    }
  }, []);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const logoTranslate = useRef(new Animated.Value(-10)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const taglineTranslate = useRef(new Animated.Value(16)).current;
  const heroContainerAnim = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.82)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const ctaTranslate = useRef(new Animated.Value(32)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoTranslate, { toValue: 0, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(heroContainerAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(heroScale, { toValue: 1, tension: 45, friction: 7, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(taglineAnim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(taglineTranslate, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(badgeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        Animated.spring(badgeScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ctaAnim, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(ctaTranslate, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const ctaBlock = (
    <Animated.View style={[styles.ctaBlock, { opacity: ctaAnim, transform: [{ translateY: ctaTranslate }] }]}>
      <TouchableOpacity
        style={styles.mailBtn}
        onPress={() => router.push('/register')}
        activeOpacity={0.82}
      >
        <View style={styles.mailBtnInner}>
          <Ionicons name="mail-outline" size={20} color={Colors.white} />
          <Text style={styles.mailBtnText}>Commencer gratuitement</Text>
        </View>
        <View style={styles.mailBtnArrow}>
          <Ionicons name="arrow-forward" size={16} color={Colors.white} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/login')}
        activeOpacity={0.7}
        style={styles.loginRow}
      >
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

        <View style={[styles.blob, styles.blob1]} />
        <View style={[styles.blob, styles.blob2]} />
        <View style={[styles.blob, styles.blob3]} />

        <View style={styles.desktopInner}>
          <View style={styles.desktopLeft}>
            <Animated.Image
              source={require('@/assets/images/logoLTBwhitoutbaground.png')}
              style={[styles.logoDesktop, { opacity: logoAnim, transform: [{ translateY: logoTranslate }] }]}
              resizeMode="contain"
            />

            <Animated.View style={{ opacity: taglineAnim, transform: [{ translateY: taglineTranslate }] }}>
              <View style={styles.taglineBadge}>
                <View style={styles.taglineDot} />
                <Text style={styles.taglineBadgeText}>Plateforme de location entre particuliers</Text>
              </View>
              <Text style={styles.heroTitleDesktop}>
                Louez tout,{'\n'}
                <Text style={styles.heroTitleAccent}>sans limites</Text>
              </Text>
              <Text style={styles.heroSubDesktop}>
                La première plateforme qui connecte voisins et objets. Simple, sécurisé, local — comme un cycle infini d'échanges.
              </Text>
            </Animated.View>

            <View style={styles.valueCardsDesktop}>
              {VALUE_PROPS.map((vp, i) => (
                <ValueCard key={vp.icon} {...vp} delay={900 + i * 130} />
              ))}
            </View>
          </View>

          <View style={styles.desktopRight}>
            <Animated.View
              style={[
                styles.infinityWrapper,
                { opacity: heroContainerAnim, transform: [{ scale: heroScale }] },
              ]}
            >
              <InfinityHero size={320} />

              <Animated.View style={[styles.badge, styles.badgeTopLeft, { opacity: badgeAnim, transform: [{ scale: badgeScale }] }]}>
                <Ionicons name="people-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.badgeText}>+12k voisins actifs</Text>
              </Animated.View>

              <Animated.View style={[styles.badge, styles.badgeBottomRight, { opacity: badgeAnim, transform: [{ scale: badgeScale }] }]}>
                <Ionicons name="star-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.badgeText}>4.8 / 5 de moyenne</Text>
              </Animated.View>
            </Animated.View>

            <View style={styles.ctaCardDesktop}>
              {ctaBlock}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rootMobile}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.blob, styles.blob1Mobile]} />
      <View style={[styles.blob, styles.blob2Mobile]} />

      <ScrollView
        contentContainerStyle={styles.mobileScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={[styles.logoMobile, { opacity: logoAnim, transform: [{ translateY: logoTranslate }] }]}
          resizeMode="contain"
        />

        <Animated.View style={{ opacity: taglineAnim, transform: [{ translateY: taglineTranslate }], marginBottom: 6 }}>
          <View style={[styles.taglineBadge, { alignSelf: 'flex-start' }]}>
            <View style={styles.taglineDot} />
            <Text style={styles.taglineBadgeText}>Location entre voisins</Text>
          </View>
          <Text style={styles.heroTitleMobile}>
            Louez tout,{'\n'}
            <Text style={styles.heroTitleAccent}>sans limites</Text>
          </Text>
          <Text style={styles.heroSubMobile}>
            Simple, sécurisé, local — comme un cycle infini d'échanges.
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.infinityWrapperMobile,
            { opacity: heroContainerAnim, transform: [{ scale: heroScale }] },
          ]}
        >
          <InfinityHero size={240} />

          <Animated.View style={[styles.badge, styles.badgeMobileLeft, { opacity: badgeAnim, transform: [{ scale: badgeScale }] }]}>
            <Ionicons name="people-outline" size={12} color={Colors.primaryDark} />
            <Text style={styles.badgeText}>+12k actifs</Text>
          </Animated.View>

          <Animated.View style={[styles.badge, styles.badgeMobileRight, { opacity: badgeAnim, transform: [{ scale: badgeScale }] }]}>
            <Ionicons name="star-outline" size={12} color={Colors.primaryDark} />
            <Text style={styles.badgeText}>4.8 / 5</Text>
          </Animated.View>
        </Animated.View>

        <View style={styles.valuePropsMobile}>
          {VALUE_PROPS.map((vp, i) => (
            <ValueCard key={vp.icon} {...vp} delay={800 + i * 120} />
          ))}
        </View>

        {ctaBlock}
      </ScrollView>
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

  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blob1: {
    top: -180,
    right: -140,
    width: 500,
    height: 500,
    backgroundColor: Colors.primary,
    opacity: 0.07,
  },
  blob2: {
    bottom: -200,
    left: -160,
    width: 560,
    height: 560,
    backgroundColor: Colors.primaryDark,
    opacity: 0.055,
  },
  blob3: {
    top: '35%',
    right: '20%',
    width: 240,
    height: 240,
    backgroundColor: Colors.primaryLight,
    opacity: 0.09,
  },
  blob1Mobile: {
    top: -100,
    right: -80,
    width: 300,
    height: 300,
    backgroundColor: Colors.primary,
    opacity: 0.07,
  },
  blob2Mobile: {
    bottom: 100,
    left: -100,
    width: 320,
    height: 320,
    backgroundColor: Colors.primaryDark,
    opacity: 0.055,
  },

  mobileScroll: {
    paddingTop: Platform.OS === 'web' ? 52 : 58,
    paddingHorizontal: 22,
    paddingBottom: 32,
  },

  logoMobile: {
    width: '65%',
    height: 40,
    alignSelf: 'center',
    marginBottom: 28,
  },
  logoDesktop: {
    width: 190,
    height: 46,
    marginBottom: 36,
  },

  taglineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight + '55',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  taglineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryDark,
  },
  taglineBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: Colors.primaryDark,
    letterSpacing: 0.2,
  },

  heroTitleMobile: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    lineHeight: 40,
    marginBottom: 10,
  },
  heroTitleDesktop: {
    fontSize: 46,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    lineHeight: 56,
    marginBottom: 14,
  },
  heroTitleAccent: {
    color: Colors.primaryDark,
  },
  heroSubMobile: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  heroSubDesktop: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    lineHeight: 25,
    marginBottom: 36,
    maxWidth: 440,
  },

  infinityWrapper: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 32,
  },
  infinityWrapperMobile: {
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 16,
  },

  badge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.white,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
  },
  badgeTopLeft: {
    top: 12,
    left: -24,
  },
  badgeBottomRight: {
    bottom: 12,
    right: -24,
  },
  badgeMobileLeft: {
    top: '40%',
    left: -8,
  },
  badgeMobileRight: {
    top: '40%',
    right: -8,
  },

  valueCardsDesktop: {
    gap: 10,
  },
  valuePropsMobile: {
    gap: 10,
    marginBottom: 24,
  },
  valueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  valueCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  valueCardText: {
    flex: 1,
  },
  valueCardTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    marginBottom: 2,
  },
  valueCardDesc: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  desktopInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 1160,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 56,
    paddingVertical: 40,
    gap: 40,
  },
  desktopLeft: {
    flex: 52,
    justifyContent: 'center',
  },
  desktopRight: {
    flex: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },
  ctaCardDesktop: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },

  ctaBlock: {
    gap: 12,
  },
  mailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryDark,
    height: 58,
    borderRadius: 16,
    paddingHorizontal: 20,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  mailBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mailBtnArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mailBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loginText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: Colors.primaryDark,
    textDecorationLine: 'underline',
  },
  legalRow: {
    alignItems: 'center',
    paddingTop: 4,
  },
  legalLink: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
