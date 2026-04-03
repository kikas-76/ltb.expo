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
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function LandingScreen() {
  const { signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const { width, height } = useWindowDimensions();
  const HERO_HEIGHT = height * 0.62;

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
  const btn1Anim = useRef(new Animated.Value(0)).current;
  const btn2Anim = useRef(new Animated.Value(0)).current;
  const loginAnim = useRef(new Animated.Value(0)).current;
  const btn1Translate = useRef(new Animated.Value(30)).current;
  const btn2Translate = useRef(new Animated.Value(30)).current;
  const loginTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(btn1Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(btn1Translate, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btn2Anim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(btn2Translate, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(loginAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(loginTranslate, { toValue: 0, duration: 300, useNativeDriver: true }),
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

  return (
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <Image
        source={{ uri: 'https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2' }}
        style={[styles.heroImage, { height: HERO_HEIGHT }]}
        resizeMode="cover"
      />

      <LinearGradient
        colors={[
          'transparent',
          'rgba(245,242,227,0.15)',
          'rgba(245,242,227,0.6)',
          'rgba(245,242,227,0.92)',
          Colors.background,
        ]}
        locations={[0, 0.38, 0.6, 0.8, 1]}
        style={[styles.gradient, { top: HERO_HEIGHT * 0.28, height: HERO_HEIGHT * 0.72 }]}
      />

      <Animated.View
        style={[
          styles.logoWrap,
          { top: HERO_HEIGHT * 0.28 },
          {
            opacity: logoAnim,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={[styles.logo, { width: Math.min(width * 0.82, 340) }]}
          resizeMode="contain"
        />
      </Animated.View>

      <View style={[styles.bottom, { paddingBottom: Platform.OS === 'web' ? 52 : 44, paddingHorizontal: Math.min(width * 0.07, 32) }]}>
        <View style={styles.actions}>
          <Animated.View
            style={{
              opacity: btn1Anim,
              transform: [{ translateY: btn1Translate }],
            }}
          >
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

          <Animated.View
            style={{
              opacity: btn2Anim,
              transform: [{ translateY: btn2Translate }],
            }}
          >
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
        </View>

        <Animated.View
          style={{
            opacity: loginAnim,
            transform: [{ translateY: loginTranslate }],
          }}
        >
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  logoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: 72,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  actions: {
    gap: 14,
    marginBottom: 24,
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
});
