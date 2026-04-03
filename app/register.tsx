import { useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import InfiniteIconStrip from '@/components/InfiniteIconStrip';
import { useAuth } from '@/contexts/AuthContext';

const BG = '#F5F0E8';
const GREEN = '#B7BF9C';
const GREEN_LIGHT = '#ECEEE6';

function Stepper({ active }: { active: number }) {
  return (
    <View style={styles.stepper}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={[styles.stepDot, active === n && styles.stepDotActive]} />
      ))}
    </View>
  );
}

function GoogleIcon() {
  return (
    <View style={googleIconStyles.container}>
      <Text style={googleIconStyles.g}>G</Text>
    </View>
  );
}

const googleIconStyles = StyleSheet.create({
  container: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  g: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#4285F4',
  },
});

export default function RegisterScreen() {
  const { signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleRegister = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error: googleError, emailConflict } = await signInWithGoogle();
    setGoogleLoading(false);
    if (emailConflict) {
      router.replace({ pathname: '/link-google-account', params: { email: emailConflict } } as any);
      return;
    }
    if (googleError) {
      setError(googleError);
    }
  };

  const handleSubmit = () => {
    setError(null);
    if (!email.trim()) { setError("L'email est requis."); return; }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) { setError('Adresse email invalide.'); return; }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return; }

    router.push({ pathname: '/onboarding/profile', params: { email, password } });
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
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/logoLTBwhitoutbaground.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Stepper active={1} />
        </View>

        <InfiniteIconStrip />

        <View style={styles.body}>
          <Text style={styles.title}>Créez votre compte</Text>
          <Text style={styles.subtitle}>Prêt à consommer différemment ?</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
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

          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Confirmer le mot de passe"
              placeholderTextColor="#A8A8A0"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showConfirm
                ? <Ionicons name="eye-off-outline" size={18} color="#A8A8A0" />
                : <Ionicons name="eye-outline" size={18} color="#A8A8A0" />
              }
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, submitting && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>S'inscrire</Text>
            }
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou continuer avec</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleBtn, googleLoading && { opacity: 0.65 }]}
            onPress={handleGoogleRegister}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#1C1C18" />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.googleText}>S'inscrire avec Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              Déjà un compte ?{' '}
              <Text style={styles.loginLinkBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 28,
    gap: 20,
  },
  logo: {
    width: 200,
    height: 52,
  },
  stepper: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D5CEBC',
  },
  stepDotActive: {
    width: 28,
    borderRadius: 5,
    backgroundColor: GREEN,
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
    color: '#1C1C18',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#7A7A70',
    marginTop: -4,
    lineHeight: 22,
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
  inputFlex: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#1C1C18',
  },
  btn: {
    backgroundColor: GREEN,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0D8C8',
  },
  dividerText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#A8A8A0',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0D8C8',
    height: 54,
    paddingHorizontal: 22,
  },
  googleText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1C1C18',
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  loginLinkText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#7A7A70',
  },
  loginLinkBold: {
    fontFamily: 'Inter-SemiBold',
    color: GREEN,
  },
});
