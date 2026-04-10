import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

const ORANGE = '#D97706';

export default function WalletRefreshScreen() {
  const insets = useSafeAreaInsets();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const verifyFirst = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setChecking(false); return; }
        setAccessToken(session.access_token);

        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-account-status`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
            body: JSON.stringify({ access_token: session.access_token }),
          }
        );
        const data = await response.json();
        if (data.complete === true) {
          router.replace('/wallet');
          return;
        }
      } catch {}
      setChecking(false);
    };
    verifyFirst();
  }, []);

  const resumeOnboarding = async () => {
    if (Platform.OS === 'web') {
      router.replace('/wallet/onboarding');
    } else {
      if (!accessToken) {
        Alert.alert('Erreur', 'Reconnecte-toi');
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-connect-account`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
            body: JSON.stringify({ access_token: accessToken }),
          }
        );
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          Alert.alert('Erreur', data.error || 'URL manquante');
        }
      } catch (err: any) {
        Alert.alert('Erreur', err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const steps = [
    {
      label: 'Compte créé',
      status: 'done' as const,
    },
    {
      label: 'Informations personnelles',
      status: 'active' as const,
    },
    {
      label: 'Compte bancaire (IBAN)',
      status: 'pending' as const,
    },
  ];

  if (checking) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="warning-outline" size={64} color={ORANGE} />
        </View>

        <Text style={styles.title}>Inscription incomplète</Text>
        <Text style={styles.subtitle}>
          Tu n'as pas terminé la configuration de ton compte Stripe.{'\n'}Reprends où tu t'es arrêté.
        </Text>

        <View style={styles.card}>
          {steps.map((step, index) => (
            <View key={step.label}>
              <View style={styles.stepRow}>
                <StepIndicator status={step.status} />
                <Text
                  style={[
                    styles.stepLabel,
                    step.status === 'pending' && styles.stepLabelMuted,
                  ]}
                >
                  {step.label}
                </Text>
                <StepBadge status={step.status} />
              </View>
              {index < steps.length - 1 && (
                <View style={styles.stepConnector} />
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          activeOpacity={0.85}
          onPress={resumeOnboarding}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>Reprendre l'inscription →</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.laterBtn}
          activeOpacity={0.7}
          onPress={() => router.replace('/wallet')}
        >
          <Text style={styles.laterBtnText}>Plus tard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StepIndicator({ status }: { status: 'done' | 'active' | 'pending' }) {
  if (status === 'done') {
    return (
      <View style={[styles.stepDot, styles.stepDotDone]}>
        <Text style={styles.stepDotCheck}>✓</Text>
      </View>
    );
  }
  if (status === 'active') {
    return <View style={[styles.stepDot, styles.stepDotActive]} />;
  }
  return <View style={[styles.stepDot, styles.stepDotPending]} />;
}

function StepBadge({ status }: { status: 'done' | 'active' | 'pending' }) {
  if (status === 'done') {
    return <Text style={styles.badgeDone}>✓</Text>;
  }
  if (status === 'active') {
    return <Text style={styles.badgeActive}>En cours...</Text>;
  }
  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  iconWrap: {
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 390,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
    }),
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  stepConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 15,
    marginVertical: 2,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepDotDone: {
    backgroundColor: Colors.primaryDark,
  },
  stepDotActive: {
    backgroundColor: ORANGE,
  },
  stepDotPending: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  stepDotCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  stepLabel: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  stepLabelMuted: {
    color: '#9B9B9B',
    fontFamily: 'Inter-Regular',
  },
  badgeDone: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.primaryDark,
  },
  badgeActive: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: ORANGE,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(27,67,50,0.3)' },
    }),
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  laterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  laterBtnText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#9B9B9B',
  },
});
