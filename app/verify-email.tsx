import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

const RESEND_COOLDOWN = 60;

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email: string }>();
  const email = params.email ?? '';

  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(iconScale, { toValue: 1, damping: 14, stiffness: 180, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    if (!email) {
      setResendError("Adresse email introuvable. Recommence l'inscription.");
      return;
    }
    setResending(true);
    setResendSuccess(false);
    setResendError(null);

    const redirectUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/email-confirmed`
      : 'louetonbien://email-confirmed';

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectUrl },
    });

    setResending(false);
    if (!error) {
      setResendSuccess(true);
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => setResendSuccess(false), 5000);
    } else {
      setResendError("L'envoi a échoué. Vérifie ton adresse email et réessaie.");
    }
  };

  const handleGoToLogin = () => {
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={42} color={Colors.primaryDark} />
          </View>
          <View style={styles.iconBadge}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.title}>Vérifie ta boîte mail</Text>
          <Text style={styles.subtitle}>
            Un lien de confirmation a été envoyé à
          </Text>
          <View style={styles.emailChip}>
            <Ionicons name="mail" size={14} color={Colors.primaryDark} />
            <Text style={styles.emailChipText} numberOfLines={1}>{email}</Text>
          </View>
          <Text style={styles.instructions}>
            Clique sur le lien dans l'email pour activer ton compte et continuer l'inscription. Vérifie également tes spams.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.actionsBlock, { opacity: fadeAnim }]}>
          {resendSuccess && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primaryDark} />
              <Text style={styles.successBannerText}>Email renvoyé avec succès !</Text>
            </View>
          )}

          {resendError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.errorBannerText}>{resendError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.resendBtn, (cooldown > 0 || resending) && styles.resendBtnDisabled]}
            onPress={handleResend}
            disabled={resending || cooldown > 0}
            activeOpacity={0.8}
          >
            {resending
              ? <ActivityIndicator size="small" color={Colors.primaryDark} />
              : (
                <>
                  <Ionicons name="refresh-outline" size={16} color={cooldown > 0 ? Colors.textMuted : Colors.primaryDark} />
                  <Text style={[styles.resendBtnText, cooldown > 0 && styles.resendBtnTextDisabled]}>
                    {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer l'email"}
                  </Text>
                </>
              )
            }
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleGoToLogin} activeOpacity={0.85}>
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.helpRow}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.helpText}>
            Une fois ton email confirmé, tu pourras compléter ton profil.
          </Text>
        </View>
      </View>

      <Image
        source={require('@/assets/images/logoLTBwhitoutbaground.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backBtn: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 28,
  },
  iconWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primarySurface,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20 },
      android: { elevation: 8 },
      web: { boxShadow: '0 8px 32px rgba(183,191,156,0.35)' },
    }),
  },
  iconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  textBlock: {
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  emailChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.primaryDark,
    flexShrink: 1,
  },
  instructions: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  actionsBlock: {
    width: '100%',
    gap: 14,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
  },
  successBannerText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
  },
  errorBannerText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.error,
    flex: 1,
    lineHeight: 18,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.white,
  },
  resendBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  resendBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.primaryDark,
  },
  resendBtnTextDisabled: {
    color: Colors.textMuted,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  dividerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  loginBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(183,191,156,0.45)' },
    }),
  },
  loginBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 4,
  },
  helpText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  logo: {
    position: 'absolute',
    bottom: 32,
    width: 120,
    height: 32,
    opacity: 0.4,
  },
});
