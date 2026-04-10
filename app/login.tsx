import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useDeepLink } from '@/contexts/DeepLinkContext';
import { Colors } from '@/constants/colors';


export default function LoginScreen() {
  const { signIn, profile, profileLoading, session } = useAuth();
  const { pendingListingId, setPendingListingId } = useDeepLink();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [waitingForProfile, setWaitingForProfile] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(24)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(formFade, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(formSlide, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const animateBtnPress = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (!waitingForProfile) return;
    if (profileLoading) return;

    setWaitingForProfile(false);
    setSubmitting(false);

    if (!profile) {
      setError("Aucun compte n'existe avec cette adresse email.");
      return;
    }

    if (pendingListingId) {
      const id = pendingListingId;
      setPendingListingId(null);
      router.replace(`/listing/${id}` as any);
    } else {
      router.replace('/(tabs)');
    }
  }, [waitingForProfile, profileLoading, profile]);

  const handleLogin = async () => {
    animateBtnPress();
    setError(null);

    if (!email.trim()) { setError("L'email est requis."); return; }
    if (!password) { setError('Le mot de passe est requis.'); return; }

    setSubmitting(true);
    const { error: authError } = await signIn(email, password);

    if (authError) {
      setSubmitting(false);
      setError(authError);
      return;
    }

    setWaitingForProfile(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Image
            source={require('@/assets/images/logoLTBwhitoutbaground.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.body,
            { opacity: formFade, transform: [{ translateY: formSlide }] },
          ]}
        >
          <Text style={styles.title}>Bon retour !</Text>
          <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>

          {error && (
            <Animated.View style={[styles.errorBox, { opacity: formFade }]}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#A8A8A0"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Mot de passe"
              placeholderTextColor="#A8A8A0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showPassword
                ? <Ionicons name="eye-off-outline" size={18} color="#A8A8A0" />
                : <Ionicons name="eye-outline" size={18} color="#A8A8A0" />
              }
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotLink} activeOpacity={0.6} onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[styles.btn, (submitting || waitingForProfile) && { opacity: 0.65 }]}
              onPress={handleLogin}
              disabled={submitting || waitingForProfile}
              activeOpacity={0.85}
            >
              {(submitting || waitingForProfile)
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Se connecter</Text>
              }
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={() => router.push('/register')} style={styles.registerLink}>
            <Text style={styles.registerLinkText}>
              Pas encore de compte ?{' '}
              <Text style={styles.registerLinkBold}>S'inscrire</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 28,
  },
  logo: {
    width: 200,
    height: 52,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 14,
    maxWidth: 390,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    marginTop: -4,
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: Colors.error,
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
    borderColor: Colors.border,
    height: 54,
    paddingHorizontal: 22,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: Colors.text,
  },
  inputFlex: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: Colors.text,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: Colors.primary,
  },
  btn: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 4,
    marginTop: 4,
  },
  registerLinkText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
  },
  registerLinkBold: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.primary,
  },
});
