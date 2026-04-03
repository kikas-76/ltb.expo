import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';

const VALUE_PROPS = [
  {
    icon: 'search-outline' as const,
    title: 'Trouve',
    description: 'Des objets près de chez toi',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Loue en confiance',
    description: 'Paiement sécurisé et caution protégée',
  },
  {
    icon: 'cash-outline' as const,
    title: "Gagne de l'argent",
    description: 'Rentabilise tes objets inutilisés',
  },
];

export default function LandingScreen() {
  const { signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
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
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(18)).current;
  const prop1Anim = useRef(new Animated.Value(0)).current;
  const prop1Translate = useRef(new Animated.Value(20)).current;
  const prop2Anim = useRef(new Animated.Value(0)).current;
  const prop2Translate = useRef(new Animated.Value(20)).current;
  const prop3Anim = useRef(new Animated.Value(0)).current;
  const prop3Translate = useRef(new Animated.Value(20)).current;
  const btn1Anim = useRef(new Animated.Value(0)).current;
  const btn1Translate = useRef(new Animated.Value(24)).current;
  const btn2Anim = useRef(new Animated.Value(0)).current;
  const btn2Translate = useRef(new Animated.Value(24)).current;
  const loginAnim = useRef(new Animated.Value(0)).current;
  const loginTranslate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(heroAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(heroTranslate, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
      Animated.stagger(100, [
        Animated.parallel([
          Animated.timing(prop1Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(prop1Translate, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(prop2Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(prop2Translate, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(prop3Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(prop3Translate, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(btn1Anim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(btn1Translate, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btn2Anim, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(btn2Translate, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(loginAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(loginTranslate, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    const { error, emailConflict } = await signInWithGoogle();
    setGoogleLoading(false);
    if (emailConflict) {
      router.replace({ pathname: '/link-google-account', params: { email: emailConflict } } as any);
    }
  };

  const propAnims = [
    { opacity: prop1Anim, translateY: prop1Translate },
    { opacity: prop2Anim, translateY: prop2Translate },
    { opacity: prop3Anim, translateY: prop3Translate },
  ];

  const ctaBlock = (
    <View style={[styles.ctaBlock, !isMobile && styles.ctaBlockDesktop]}>
      <Animated.View style={{ opacity: btn1Anim, transform: [{ translateY: btn1Translate }] }}>
        <TouchableOpacity
          style={styles.mailBtn}
          onPress={() => router.push('/register')}
          activeOpacity={0.82}
        >
          <Ionicons name="mail-outline" size={20} color={Colors.white} />
          <Text style={styles.mailBtnText}>S'inscrire par Mail</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.separator, { opacity: btn1Anim }]}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>ou</Text>
        <View style={styles.separatorLine} />
      </Animated.View>

      <Animated.View style={{ opacity: btn2Anim, transform: [{ translateY: btn2Translate }] }}>
        <TouchableOpacity
          style={[styles.googleBtn, googleLoading && { opacity: 0.65 }]}
          activeOpacity={0.82}
          disabled={googleLoading}
          onPress={handleGoogleRegister}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            <>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleBtnText}>S'inscrire via Google</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={{ opacity: loginAnim, transform: [{ translateY: loginTranslate }] }}>
        <TouchableOpacity
          onPress={() => router.push('/login')}
          activeOpacity={0.7}
          style={styles.loginRow}
        >
          <Text style={styles.loginText}>Vous avez déjà un compte ? </Text>
          <Text style={styles.loginLink}>Se connecter</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  if (!isMobile) {
    return (
      <View style={styles.rootDesktop}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

        <View style={styles.decCircle1} />
        <View style={styles.decCircle2} />
        <View style={styles.decCircle3} />

        <View style={styles.desktopInner}>
          <View style={styles.desktopLeft}>
            <Animated.Image
              source={require('@/assets/images/logoLTBwhitoutbaground.png')}
              style={[styles.logoDesktop, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}
              resizeMode="contain"
            />

            <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroTranslate }] }}>
              <Text style={styles.heroTitleDesktop}>Louez tout,{'\n'}entre voisins</Text>
              <Text style={styles.heroSubDesktop}>
                La plateforme de location d'objets entre particuliers.{'\n'}Simple, sécurisé, local.
              </Text>
            </Animated.View>

            <View style={styles.valuePropsList}>
              {VALUE_PROPS.map((vp, i) => (
                <Animated.View
                  key={vp.icon}
                  style={[
                    styles.valuePropRow,
                    {
                      opacity: propAnims[i].opacity,
                      transform: [{ translateY: propAnims[i].translateY }],
                    },
                  ]}
                >
                  <View style={styles.valuePropIcon}>
                    <Ionicons name={vp.icon} size={22} color={Colors.primaryDark} />
                  </View>
                  <View style={styles.valuePropText}>
                    <Text style={styles.valuePropTitle}>{vp.title}</Text>
                    <Text style={styles.valuePropDesc}>{vp.description}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>

            <Animated.View style={{ opacity: loginAnim }}>
              <TouchableOpacity onPress={() => router.push('/legal')} activeOpacity={0.7}>
                <Text style={styles.legalLink}>Mentions légales · CGU · Confidentialité</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={styles.desktopRight}>
            <View style={styles.ctaCard}>
              <Text style={styles.ctaCardTitle}>Commencer maintenant</Text>
              <Text style={styles.ctaCardSub}>Rejoins des milliers de voisins qui partagent déjà leurs objets.</Text>
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

      <View style={styles.decCircle1} />
      <View style={styles.decCircle2Mobile} />

      <ScrollView
        contentContainerStyle={styles.mobileScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={[styles.logoMobile, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />

        <Animated.View style={[styles.heroMobile, { opacity: heroAnim, transform: [{ translateY: heroTranslate }] }]}>
          <Text style={styles.heroTitleMobile}>Louez tout,{'\n'}entre voisins</Text>
          <Text style={styles.heroSubMobile}>
            La plateforme de location d'objets entre particuliers. Simple, sécurisé, local.
          </Text>
        </Animated.View>

        <View style={styles.valuePropsList}>
          {VALUE_PROPS.map((vp, i) => (
            <Animated.View
              key={vp.icon}
              style={[
                styles.valuePropRow,
                {
                  opacity: propAnims[i].opacity,
                  transform: [{ translateY: propAnims[i].translateY }],
                },
              ]}
            >
              <View style={styles.valuePropIcon}>
                <Ionicons name={vp.icon} size={22} color={Colors.primaryDark} />
              </View>
              <View style={styles.valuePropText}>
                <Text style={styles.valuePropTitle}>{vp.title}</Text>
                <Text style={styles.valuePropDesc}>{vp.description}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {ctaBlock}

        <Animated.View style={{ opacity: loginAnim, alignItems: 'center', marginBottom: 32 }}>
          <TouchableOpacity onPress={() => router.push('/legal')} activeOpacity={0.7}>
            <Text style={styles.legalLink}>Mentions légales · CGU · Confidentialité</Text>
          </TouchableOpacity>
        </Animated.View>
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
  decCircle1: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: Colors.primary,
    opacity: 0.08,
  },
  decCircle2: {
    position: 'absolute',
    bottom: -160,
    left: -120,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: Colors.primaryDark,
    opacity: 0.06,
  },
  decCircle2Mobile: {
    position: 'absolute',
    bottom: 80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.primaryDark,
    opacity: 0.06,
  },
  decCircle3: {
    position: 'absolute',
    top: '40%',
    left: '30%',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primaryLight,
    opacity: 0.1,
  },
  mobileScroll: {
    paddingTop: Platform.OS === 'web' ? 52 : 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  logoMobile: {
    width: '70%',
    height: 44,
    alignSelf: 'center',
    marginBottom: 36,
  },
  heroMobile: {
    marginBottom: 32,
  },
  heroTitleMobile: {
    fontSize: 30,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    lineHeight: 38,
    marginBottom: 10,
  },
  heroSubMobile: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  desktopInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 48,
    paddingVertical: 40,
  },
  desktopLeft: {
    flex: 55,
    paddingRight: 48,
    justifyContent: 'center',
  },
  desktopRight: {
    flex: 45,
    justifyContent: 'center',
  },
  logoDesktop: {
    width: 180,
    height: 44,
    marginBottom: 40,
  },
  heroTitleDesktop: {
    fontSize: 40,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    lineHeight: 50,
    marginBottom: 14,
  },
  heroSubDesktop: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 36,
  },
  valuePropsList: {
    gap: 16,
    marginBottom: 36,
  },
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  valuePropIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  valuePropText: {
    flex: 1,
  },
  valuePropTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    marginBottom: 2,
  },
  valuePropDesc: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  ctaCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  ctaCardTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    marginBottom: 6,
  },
  ctaCardSub: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 28,
  },
  ctaBlock: {
    gap: 14,
  },
  ctaBlockDesktop: {
    gap: 14,
  },
  mailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 100,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  mailBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 2,
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  separatorText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    height: 56,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  googleG: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    letterSpacing: 0.15,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingTop: 4,
    paddingBottom: 4,
  },
  loginText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    textDecorationLine: 'underline',
  },
  legalLink: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
