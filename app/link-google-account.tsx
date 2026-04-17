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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';


export default function LinkGoogleAccountScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [linked, setLinked] = useState(false);

  const handleLink = async () => {
    setError(null);
    if (!password) {
      setError('Le mot de passe est requis.');
      return;
    }

    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email ?? '',
      password,
    });

    if (signInError) {
      setSubmitting(false);
      setError('Mot de passe incorrect. Veuillez réessayer.');
      return;
    }

    const { error: linkError } = await supabase.auth.linkIdentity({ provider: 'google' });

    if (linkError) {
      setSubmitting(false);
      setError('Impossible de lier le compte Google : ' + linkError.message);
      return;
    }

    setSubmitting(false);
    setLinked(true);

    setTimeout(() => {
      router.replace('/(tabs)');
    }, 2000);
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
        </View>

        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Ionicons name="link-outline" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Lier votre compte Google</Text>
          <Text style={styles.subtitle}>
            Un compte existe déjà avec l'adresse{' '}
            <Text style={styles.emailHighlight}>{email}</Text>.{'\n'}
            Confirmez votre mot de passe pour lier votre compte Google à cet email.
          </Text>

          {linked ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>
                Compte lié avec succès ! Redirection en cours...
              </Text>
            </View>
          ) : (
            <>
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.emailDisplay}>
                <Text style={styles.emailDisplayLabel}>Email</Text>
                <Text style={styles.emailDisplayValue}>{email}</Text>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  placeholder="Mot de passe actuel"
                  placeholderTextColor="#A8A8A0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoFocus
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

              <TouchableOpacity
                style={[styles.btn, submitting && { opacity: 0.65 }]}
                onPress={handleLink}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Lier mon compte Google</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => router.replace('/login')}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Annuler, se connecter avec email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
    paddingTop: 16,
    gap: 16,
    maxWidth: 390,
    width: '100%',
    alignSelf: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  emailHighlight: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
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
  successBox: {
    backgroundColor: Colors.primarySurface,
    borderRadius: 12,
    padding: 16,
  },
  successText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  emailDisplay: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 2,
  },
  emailDisplayLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emailDisplayValue: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
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
  inputFlex: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: Colors.text,
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
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
  },
});
