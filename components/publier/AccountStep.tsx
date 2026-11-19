import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import GoogleButton from '@/components/GoogleButton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { setAuthReturnPath } from '@/lib/authReturn';
import { isInAppBrowser } from '@/lib/inAppBrowser';
import { PASSWORD_HINT, passwordProblem } from '@/lib/passwordRules';
import { fetchDraftStatus, forgetPublishDraft } from '@/lib/publishDraft';
import { frenchError } from '@/lib/errorMessages';

export interface DraftSummary {
  name: string;
  price: number;
  city: string | null;
  photoUri: string | null;
}

const FINISH_PATH = '/publier/terminer';

function confirmRedirectUrl(): string {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/email-confirmed`
    : 'louetonbien://email-confirmed';
}

/**
 * Dernière étape du lien /publier : créer le compte qui publiera l'annonce.
 * Le jeton du brouillon est déjà enregistré (cet appareil) ; il part aussi
 * dans user_metadata pour le cas où le lien de l'e-mail s'ouvre ailleurs.
 */
export default function AccountStep({
  token,
  summary,
  onEdit,
}: {
  token: string;
  summary: DraftSummary | null;
  onEdit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const inApp = isInAppBrowser();

  const goSignIn = () => {
    setAuthReturnPath(FINISH_PATH);
    router.push('/login');
  };

  const handleGoogle = async () => {
    setError(null);
    setAuthReturnPath(FINISH_PATH);
    setGoogleLoading(true);
    const { error: googleError, emailConflict } = await signInWithGoogle();
    setGoogleLoading(false);
    if (emailConflict) {
      router.push({ pathname: '/link-google-account', params: { email: emailConflict } });
      return;
    }
    if (googleError) setError(googleError);
  };

  const handleEmail = async () => {
    setError(null);
    setExistingAccount(false);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Adresse e-mail invalide.');
      return;
    }
    const weak = passwordProblem(password);
    if (weak) {
      setError(weak);
      return;
    }
    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { emailRedirectTo: confirmRedirectUrl(), data: { publish_draft: token } },
    });
    setSubmitting(false);
    if (signUpError) {
      const msg = signUpError.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('user already')) {
        setExistingAccount(true);
        setError('Un compte existe déjà avec cet e-mail.');
      } else if (signUpError.code === 'weak_password') {
        setError(passwordProblem(password) ?? 'Mot de passe trop faible.');
      } else {
        setError(frenchError(signUpError, 'Création du compte impossible. Réessayez.'));
      }
      return;
    }
    // Supabase renvoie un utilisateur sans identité quand l'e-mail est déjà pris.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setExistingAccount(true);
      setError('Un compte existe déjà avec cet e-mail.');
      return;
    }
    if (data.session) {
      router.replace(FINISH_PATH as any);
      return;
    }
    setSentTo(cleanEmail);
  };

  if (sentTo) {
    return <CheckEmail email={sentTo} token={token} onChangeEmail={() => setSentTo(null)} />;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <Text style={styles.kicker}>Dernière étape</Text>
          <Text style={styles.title}>Créez votre compte pour publier</Text>
          <Text style={styles.subtitle}>
            C'est gratuit. Votre annonce sera en ligne dès que votre compte est prêt.
          </Text>

          {summary && (
            <View style={styles.card}>
              {summary.photoUri ? (
                <Image source={{ uri: summary.photoUri }} style={styles.cardPhoto} resizeMode="cover" />
              ) : (
                <View style={[styles.cardPhoto, styles.cardPhotoEmpty]}>
                  <Ionicons name="image-outline" size={22} color={Colors.textMuted} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={2}>{summary.name}</Text>
                <Text style={styles.cardPrice}>
                  {summary.price.toFixed(2)} € <Text style={styles.cardUnit}>/ jour</Text>
                </Text>
                {summary.city && <Text style={styles.cardCity}>{summary.city}</Text>}
              </View>
              <TouchableOpacity onPress={onEdit} style={styles.editBtn} activeOpacity={0.7}>
                <Text style={styles.editText}>Modifier</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {existingAccount && (
                <TouchableOpacity onPress={goSignIn} activeOpacity={0.7}>
                  <Text style={styles.errorLink}>Se connecter avec ce compte</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!inApp && (
            <>
              <View style={styles.full}>
                <GoogleButton onPress={handleGoogle} loading={googleLoading} />
              </View>
              <View style={styles.separator}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>ou avec votre e-mail</Text>
                <View style={styles.separatorLine} />
              </View>
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder="Adresse e-mail"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Mot de passe"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              onSubmitEditing={handleEmail}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.passwordHint}>{PASSWORD_HINT}</Text>

          <TouchableOpacity
            style={[styles.cta, submitting && { opacity: 0.65 }]}
            onPress={handleEmail}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.ctaText}>Créer mon compte et publier</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.consent}>
            En créant un compte, vous confirmez avoir 18 ans et acceptez les{' '}
            <Text style={styles.consentLink} onPress={() => router.push('/legal')}>Conditions d'utilisation</Text>
            {' '}et la{' '}
            <Text style={styles.consentLink} onPress={() => router.push('/legal')}>Politique de confidentialité</Text>.
          </Text>

          <TouchableOpacity onPress={goSignIn} style={styles.linkBtn} activeOpacity={0.6}>
            <Text style={styles.signInText}>
              Déjà un compte ? <Text style={styles.signInBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>

          {inApp && (
            <Text style={styles.inAppHint}>
              Pour vous connecter avec Google, ouvrez cette page dans votre navigateur (menu ⋯ puis « Ouvrir dans le navigateur »).
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * E-mail de confirmation envoyé. Le lien peut s'ouvrir dans une autre appli :
 * l'annonce y sera publiée. Ici on surveille le brouillon pour le dire.
 */
function CheckEmail({ email, token, onChangeEmail }: { email: string; token: string; onChangeEmail: () => void }) {
  const insets = useSafeAreaInsets();
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const status = await fetchDraftStatus(token);
      if (stopped) return;
      if (status && status !== 'error' && status.status === 'published' && status.listing_id) {
        setPublishedId(status.listing_id);
        forgetPublishDraft();
        return;
      }
      setTimeout(tick, 5000);
    };
    const t = setTimeout(tick, 5000);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [token]);

  const resend = async () => {
    setResending(true);
    setResendError(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: confirmRedirectUrl() } });
    setResending(false);
    if (error) {
      setResendError(frenchError(error, "L'e-mail n'a pas pu être renvoyé. Réessayez dans quelques minutes."));
      return;
    }
    setResent(true);
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.inner}>
        <View style={styles.mailIcon}>
          <Ionicons name={publishedId ? 'checkmark' : 'mail-outline'} size={34} color={Colors.white} />
        </View>
        {publishedId ? (
          <>
            <Text style={styles.title}>Votre annonce est en ligne !</Text>
            <Text style={styles.subtitle}>
              Votre compte est confirmé. Connectez-vous ici pour suivre vos demandes.
            </Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => {
                setAuthReturnPath(`/listing/${publishedId}`);
                router.push('/login');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>Se connecter</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Confirmez votre e-mail</Text>
            <Text style={styles.subtitle}>
              Nous avons envoyé un lien à <Text style={styles.bold}>{email}</Text>. Touchez-le pour publier votre
              annonce : elle sera mise en ligne même si le lien s'ouvre dans une autre application.
            </Text>
            <View style={styles.tips}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.primaryDark} />
              <Text style={styles.tipsText}>Pas reçu ? Regardez dans les spams ou les promotions.</Text>
            </View>
            <TouchableOpacity onPress={resend} disabled={resending || resent} style={styles.linkBtn} activeOpacity={0.6}>
              <Text style={styles.linkText}>{resent ? 'E-mail renvoyé' : resending ? 'Envoi…' : 'Renvoyer l\'e-mail'}</Text>
            </TouchableOpacity>
            {resendError && <Text style={[styles.errorText, styles.resendError]}>{resendError}</Text>}
            <TouchableOpacity onPress={onChangeEmail} style={styles.linkBtn} activeOpacity={0.6}>
              <Text style={styles.signInText}>
                Mauvaise adresse ? <Text style={styles.signInBold}>La modifier</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, paddingHorizontal: 20, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 440, alignItems: 'center', gap: 12 },
  full: { width: '100%' },
  kicker: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.primaryDark,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.4,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  bold: { fontFamily: 'Inter-SemiBold', color: Colors.text },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
  },
  cardPhoto: { width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.background },
  cardPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 2 },
  cardName: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.text },
  cardPrice: { fontFamily: 'Inter-Bold', fontSize: 15, color: Colors.primaryDark },
  cardUnit: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textSecondary },
  cardCity: { fontFamily: 'Inter-Regular', fontSize: 12.5, color: Colors.textSecondary },
  editBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  editText: { fontFamily: 'Inter-SemiBold', fontSize: 13.5, color: Colors.primaryDark, textDecorationLine: 'underline' },
  errorBox: { width: '100%', backgroundColor: '#FDECEA', borderRadius: 12, padding: 12, gap: 6 },
  errorText: { color: Colors.error, fontSize: 13.5, fontFamily: 'Inter-Regular', textAlign: 'center' },
  errorLink: {
    color: Colors.error,
    fontSize: 13.5,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  separator: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  separatorLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  separatorText: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textMuted },
  input: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 54,
    paddingHorizontal: 18,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: Colors.text,
  },
  inputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 54,
    paddingHorizontal: 18,
    gap: 10,
  },
  inputFlex: { flex: 1, height: '100%', fontSize: 15, fontFamily: 'Inter-Regular', color: Colors.text },
  passwordHint: {
    alignSelf: 'stretch',
    marginTop: -4,
    paddingHorizontal: 6,
    fontFamily: 'Inter-Regular',
    fontSize: 12.5,
    color: Colors.textSecondary,
  },
  cta: {
    width: '100%',
    height: 56,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: { fontFamily: 'Inter-SemiBold', fontSize: 16.5, color: Colors.white, letterSpacing: 0.2 },
  consent: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#8C8C84',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  consentLink: { fontFamily: 'Inter-SemiBold', color: '#4E6B38', textDecorationLine: 'underline' },
  linkBtn: { paddingVertical: 6 },
  resendError: { textAlign: 'center', marginTop: 4 },
  linkText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.primaryDark, textDecorationLine: 'underline' },
  signInText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.textSecondary },
  signInBold: { fontFamily: 'Inter-SemiBold', color: Colors.primaryDark },
  inAppHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  mailIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tips: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryLight + '35',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  tipsText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.primaryDark, lineHeight: 18 },
});
