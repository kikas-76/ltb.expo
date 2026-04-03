import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const BG = '#F5F0E8';
const GREEN = '#B7BF9C';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(24)).current;
  const successScale = useRef(new Animated.Value(0.6)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(formFade, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(formSlide, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, { toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(iconPulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const animateBtnPress = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = () => {
    animateBtnPress();
    setError(null);
    if (!email.trim()) { setError("L'email est requis."); return; }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) { setError('Adresse email invalide.'); return; }

    setSent(true);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(successFade, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <Animated.View style={[styles.topBar, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back-outline" size={20} color="#1C1C18" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={[
            styles.body,
            { opacity: formFade, transform: [{ translateY: formSlide }] },
          ]}
        >
          <View style={styles.titleRow}>
            <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconPulse }] }]}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail-outline" size={22} color={GREEN} />
              </View>
            </Animated.View>
            <Text style={styles.title}>Mot de passe oublié ?</Text>
          </View>

          <Text style={styles.subtitle}>
            Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </Text>

          {!sent ? (
            <>
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Votre adresse email"
                  placeholderTextColor="#A8A8A0"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
            </>
          ) : (
            <Animated.View
              style={[
                styles.successBox,
                { opacity: successFade, transform: [{ scale: successScale }] },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={32} color={GREEN} />
              <Text style={styles.successTitle}>Email envoyé !</Text>
              <Text style={styles.successText}>
                Si un compte existe avec{' '}
                <Text style={styles.successEmail}>{email}</Text>
                , vous recevrez un email dans quelques instants.
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        <View style={styles.bottomActions}>
          {!sent && (
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={styles.btn}
                onPress={handleSubmit}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>Envoyer le lien</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          <TouchableOpacity onPress={() => router.push('/login')} style={styles.backToLogin}>
            <Text style={styles.backToLoginText}>
              Retour à la{' '}
              <Text style={styles.backToLoginBold}>connexion</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
    paddingBottom: 48,
  },
  topBar: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0D8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
    maxWidth: 390,
    width: '100%',
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {},
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECEEE6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1C1C18',
    letterSpacing: -0.5,
    flex: 1,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#7A7A70',
    lineHeight: 23,
  },
  errorBox: {
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#C0392B',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0D8C8',
    height: 54,
    paddingHorizontal: 22,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1C1C18',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    gap: 14,
  },
  btn: {
    backgroundColor: GREEN,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  successBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0D8C8',
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1C1C18',
  },
  successText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7A7A70',
    textAlign: 'center',
    lineHeight: 22,
  },
  successEmail: {
    fontFamily: 'Inter-SemiBold',
    color: '#1C1C18',
  },
  backToLogin: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backToLoginText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7A7A70',
  },
  backToLoginBold: {
    fontFamily: 'Inter-SemiBold',
    color: GREEN,
  },
});
