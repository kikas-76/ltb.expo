import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { EmptyIllustration, type EmptyIllustrationName } from '@/components/EmptyIllustration';
import AppleButton from '@/components/AppleButton';
import GoogleButton from '@/components/GoogleButton';
import { useAuth } from '@/contexts/AuthContext';
import { setAuthReturnPath } from '@/lib/authReturn';
import { haptics } from '@/lib/haptics';

type Variant = 'listings' | 'messages' | 'account';

const CONTENT: Record<Variant, { illustration: EmptyIllustrationName; title: string; subtitle: string }> = {
  listings: {
    illustration: 'box',
    title: 'Louez vos objets',
    subtitle:
      "Connectez-vous pour publier une annonce et gagner de l'argent avec les objets qui dorment chez vous.",
  },
  messages: {
    illustration: 'chat',
    title: 'Vos demandes et messages',
    subtitle:
      'Connectez-vous pour envoyer une demande de location et échanger avec les propriétaires.',
  },
  account: {
    illustration: 'heart',
    title: 'Votre compte',
    subtitle: 'Connectez-vous pour retrouver votre profil, vos favoris et vos réglages.',
  },
};

/**
 * Onglet réservé aux comptes, vu par un visiteur : explique pourquoi un compte
 * est nécessaire et propose de se connecter, sans bloquer le reste de l'app
 * (les annonces restent consultables sans compte).
 */
export default function GuestGate({ variant }: { variant: Variant }) {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const c = CONTENT[variant];

  // Compte neuf : après l'onboarding, retour sur cet onglet.
  const rememberHere = () => setAuthReturnPath(pathname);

  const handleApple = async () => {
    setError(null);
    rememberHere();
    const { error: appleError } = await signInWithApple();
    if (appleError) setError(appleError);
  };

  const handleGoogle = async () => {
    setError(null);
    rememberHere();
    setGoogleLoading(true);
    const { error: googleError, emailConflict } = await signInWithGoogle();
    setGoogleLoading(false);
    if (emailConflict) {
      router.push({ pathname: '/link-google-account', params: { email: emailConflict } });
      return;
    }
    if (googleError) setError(googleError);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <EmptyIllustration name={c.illustration} size={132} />
        <Text style={styles.title}>{c.title}</Text>
        <Text style={styles.subtitle}>{c.subtitle}</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.buttons}>
          <AppleButton onPress={handleApple} />
          <GoogleButton onPress={handleGoogle} loading={googleLoading} />
          <TouchableOpacity
            style={styles.emailBtn}
            activeOpacity={0.85}
            onPress={() => {
              haptics.selection();
              rememberHere();
              router.push('/login');
            }}
          >
            <Text style={styles.emailBtnText}>Se connecter avec un e-mail</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => {
            rememberHere();
            router.push('/register');
          }}
          style={styles.registerLink}
          activeOpacity={0.6}
        >
          <Text style={styles.registerText}>
            Pas encore de compte ? <Text style={styles.registerBold}>S'inscrire</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.consent}>
          En créant un compte avec Apple ou Google, vous confirmez avoir 18 ans et acceptez les{' '}
          <Text style={styles.consentLink} onPress={() => router.push('/legal')}>Conditions d'utilisation</Text>
          {' '}et la{' '}
          <Text style={styles.consentLink} onPress={() => router.push('/legal')}>Politique de confidentialité</Text>.
        </Text>

        <TouchableOpacity onPress={() => router.navigate('/(tabs)')} style={styles.browseLink} activeOpacity={0.6}>
          <Text style={styles.browseText}>Parcourir les annonces sans compte</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/** Onglet réservé aux comptes : GuestGate pour un visiteur, l'écran sinon. */
export function withGuestGate<P extends object>(Screen: React.ComponentType<P>, variant: Variant) {
  return function GuestGated(props: P) {
    const { session, loading } = useAuth();
    if (loading) return <View style={styles.root} />;
    if (!session) return <GuestGate variant={variant} />;
    return <Screen {...props} />;
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 390, alignItems: 'center', gap: 12 },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorBox: { width: '100%', backgroundColor: '#FDECEA', borderRadius: 12, padding: 12 },
  errorText: { color: Colors.error, fontSize: 13, fontFamily: 'Inter-Regular', textAlign: 'center' },
  buttons: { width: '100%', gap: 12 },
  emailBtn: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailBtnText: { color: Colors.white, fontSize: 16, fontFamily: 'Inter-SemiBold', letterSpacing: 0.2 },
  registerLink: { paddingVertical: 4 },
  registerText: { fontSize: 14, fontFamily: 'Inter-Regular', color: Colors.textSecondary },
  registerBold: { fontFamily: 'Inter-SemiBold', color: Colors.primary },
  consent: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#8C8C84',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  consentLink: { fontFamily: 'Inter-SemiBold', color: '#4E6B38', textDecorationLine: 'underline' },
  browseLink: { paddingVertical: 8, marginTop: 4 },
  browseText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
    textDecorationLine: 'underline',
  },
});
