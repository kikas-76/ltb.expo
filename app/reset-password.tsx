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
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const successScale = useRef(new Animated.Value(0.6)).current;
  const successFade = useRef(new Animated.Value(0)).current;

  // On web, Supabase puts the recovery tokens in the URL hash
  useEffect(() => {
    const setSessionFromHash = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.slice(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const type = params.get('type');

          if (accessToken && refreshToken && type === 'recovery') {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!error) {
              setSessionReady(true);
              // Clean the hash from the URL
              window.history.replaceState(null, '', window.location.pathname);
            } else {
              setError('Lien expiré ou invalide. Demandez un nouveau lien.');
            }
          } else {
            setError('Lien de réinitialisation invalide.');
          }
        } else {
          // Check if there's already a session (user might have come from native deep link)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setSessionReady(true);
          } else {
            setError('Aucun lien de réinitialisation détecté.');
          }
        }
      } else {
        // Native: session should already be set via deep link handler
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
        } else {
          setError('Session expirée. Demandez un nouveau lien.');
        }
      }
      setChecking(false);
    };

    setSessionFromHash();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleReset = async () => {
    setError(null);

    if (!password.trim()) {
      setError('Le mot de passe est requis.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      setDone(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(successFade, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={styles.checkingText}>Vérification du lien...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <Animated.View
          style={[styles.body, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.titleRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed-outline" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Nouveau mot de passe</Text>
          </View>

          {!done ? (
            <>
              {!sessionReady ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error ?? 'Lien invalide ou expiré.'}</Text>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => router.replace('/forgot-password')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.retryBtnText}>Demander un nouveau lien</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.subtitle}>
                    Choisissez un nouveau mot de passe pour votre compte.
                  </Text>

                  {error && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="Nouveau mot de passe"
                      placeholderTextColor="#A8A8A0"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="Confirmer le mot de passe"
                      placeholderTextColor="#A8A8A0"
                      value={confirm}
                      onChangeText={setConfirm}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.btn, loading && { opacity: 0.7 }]}
                    onPress={handleReset}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>Réinitialiser</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            <Animated.View
              style={[styles.successBox, { opacity: successFade, transform: [{ scale: successScale }] }]}
            >
              <Ionicons name="checkmark-circle-outline" size={32} color={Colors.primary} />
              <Text style={styles.successTitle}>Mot de passe modifié !</Text>
              <Text style={styles.successText}>
                Votre mot de passe a été mis à jour avec succès.
              </Text>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => router.replace('/login')}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>Se connecter</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingTop: 80 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  checkingText: { marginTop: 16, fontSize: 15, fontFamily: 'Inter-Regular', color: Colors.textSecondary },
  body: { paddingHorizontal: 24, gap: 16, maxWidth: 390, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 24, fontFamily: 'Inter-Bold', color: Colors.text, letterSpacing: -0.5, flex: 1 },
  subtitle: { fontSize: 15, fontFamily: 'Inter-Regular', color: Colors.textSecondary, lineHeight: 23 },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 12, padding: 14, gap: 12, alignItems: 'center' },
  errorText: { color: Colors.error, fontSize: 13, fontFamily: 'Inter-Regular', textAlign: 'center' },
  retryBtn: {
    backgroundColor: Colors.primary, height: 42, borderRadius: 999,
    paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter-SemiBold' },
  inputRow: {
    backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: Colors.border,
    height: 54, paddingHorizontal: 22,
  },
  input: { flex: 1, height: '100%', fontSize: 15, fontFamily: 'Inter-Regular', color: Colors.text },
  btn: {
    backgroundColor: Colors.primary, height: 54, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter-SemiBold', letterSpacing: 0.2 },
  successBox: {
    backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    padding: 24, alignItems: 'center', gap: 12,
  },
  successTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: Colors.text },
  successText: { fontSize: 14, fontFamily: 'Inter-Regular', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
