import { useEffect, useRef } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

export default function LandingScreen() {
  const { width, height } = useWindowDimensions();
  const HERO_HEIGHT = height * 0.65;

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
  const btnAnim = useRef(new Animated.Value(0)).current;
  const btnTranslate = useRef(new Animated.Value(28)).current;
  const loginAnim = useRef(new Animated.Value(0)).current;
  const loginTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(btnTranslate, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(loginAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(loginTranslate, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: '#1A1A14' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Image
        source={require('@/assets/images/image.png')}
        style={[styles.heroImage, { height: HERO_HEIGHT }]}
        resizeMode="cover"
      />

      <LinearGradient
        colors={[
          'transparent',
          'rgba(26,26,20,0.3)',
          'rgba(26,26,20,0.72)',
          'rgba(26,26,20,0.95)',
          '#1A1A14',
        ]}
        locations={[0, 0.35, 0.58, 0.8, 1]}
        style={[styles.gradient, { top: HERO_HEIGHT * 0.2, height: HERO_HEIGHT * 0.8 }]}
      />

      <Animated.View
        style={[
          styles.logoWrap,
          { top: HERO_HEIGHT * 0.22 },
          { opacity: logoAnim, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={[styles.logo, { width: Math.min(width * 0.78, 320) }]}
          resizeMode="contain"
          tintColor="#FFFFFF"
        />
      </Animated.View>

      <View
        style={[
          styles.bottom,
          {
            paddingBottom: Platform.OS === 'web' ? 56 : 48,
            paddingHorizontal: Math.min(width * 0.07, 32),
          },
        ]}
      >
        <Animated.View style={styles.taglineWrap}>
          <Text style={styles.tagline}>Louez. Partagez. Consommez autrement.</Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: btnAnim,
            transform: [{ translateY: btnTranslate }],
            marginBottom: 20,
          }}
        >
          <TouchableOpacity
            style={styles.mainBtn}
            onPress={() => router.push('/register')}
            activeOpacity={0.82}
          >
            <Ionicons name="mail-outline" size={20} color="#1A1A14" />
            <Text style={styles.mainBtnText}>Commencer avec un email</Text>
          </TouchableOpacity>
        </Animated.View>

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
            <Text style={styles.loginText}>Déjà un compte ? </Text>
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
    height: 68,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  taglineWrap: {
    marginBottom: 28,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#D4D9C0',
    height: 56,
    borderRadius: 100,
  },
  mainBtnText: {
    color: '#1A1A14',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
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
    color: 'rgba(255,255,255,0.5)',
  },
  loginLink: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
  },
});
