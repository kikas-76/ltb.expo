import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';


function Stepper({ active }: { active: number }) {
  return (
    <View style={styles.stepper}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={[styles.stepDot, active === n && styles.stepDotActive]} />
      ))}
    </View>
  );
}

function validateSiren(siren: string): boolean {
  const digits = siren.replace(/\s/g, '');
  if (digits.length !== 9) return false;
  if (!/^\d{9}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function formatSiren(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  const parts = [];
  for (let i = 0; i < digits.length; i += 3) {
    parts.push(digits.slice(i, i + 3));
  }
  return parts.join(' ');
}

export default function AccountTypeScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const [accountType, setAccountType] = useState<'particulier' | 'pro' | null>(null);
  const [siren, setSiren] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSirenChange = (text: string) => {
    setSiren(formatSiren(text));
    setError(null);
  };

  const handleContinue = async () => {
    if (!accountType) {
      setError('Veuillez choisir un type de compte.');
      return;
    }

    if (accountType === 'pro') {
      const digits = siren.replace(/\s/g, '');
      if (!digits) {
        setError('Veuillez saisir votre numéro SIREN.');
        return;
      }
      if (!validateSiren(siren)) {
        setError('Le numéro SIREN est invalide. Vérifiez les 9 chiffres.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const userId = params.userId;
    if (!userId) {
      setError('Session introuvable. Veuillez recommencer.');
      setSubmitting(false);
      return;
    }

    const updates: Record<string, boolean | string | null> = {
      is_pro: accountType === 'pro',
      siren_number: accountType === 'pro' ? siren.replace(/\s/g, '') : null,
    };

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (updateError) {
      setError('Erreur lors de la mise à jour. Veuillez réessayer.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.replace({
      pathname: '/onboarding/address',
      params: { isPro: accountType === 'pro' ? 'true' : 'false' },
    });
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back-outline" size={22} color="#1C1C18" />
          </TouchableOpacity>
          <Image
            source={require('@/assets/images/logoLTBwhitoutbaground.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Stepper active={3} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Votre profil</Text>
          <Text style={styles.subtitle}>
            Quel type de compte souhaitez-vous créer ?
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.cardsRow}>
            <TouchableOpacity
              style={[styles.typeCard, accountType === 'particulier' && styles.typeCardSelected]}
              onPress={() => { setAccountType('particulier'); setError(null); }}
              activeOpacity={0.85}
            >
              <View style={[styles.typeIconCircle, accountType === 'particulier' && styles.typeIconCircleSelected]}>
                <Ionicons name="person-outline" size={28} color={accountType === 'particulier' ? '#fff' : Colors.primary} />
              </View>
              <Text style={[styles.typeCardTitle, accountType === 'particulier' && styles.typeCardTitleSelected]}>
                Particulier
              </Text>
              <Text style={[styles.typeCardDesc, accountType === 'particulier' && styles.typeCardDescSelected]}>
                Je loue pour un usage personnel
              </Text>
              {accountType === 'particulier' && (
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} style={styles.checkIcon} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeCard, accountType === 'pro' && styles.typeCardSelected]}
              onPress={() => { setAccountType('pro'); setError(null); }}
              activeOpacity={0.85}
            >
              <View style={[styles.typeIconCircle, accountType === 'pro' && styles.typeIconCircleSelected]}>
                <Ionicons name="business-outline" size={28} color={accountType === 'pro' ? '#fff' : Colors.primary} />
              </View>
              <Text style={[styles.typeCardTitle, accountType === 'pro' && styles.typeCardTitleSelected]}>
                Professionnel
              </Text>
              <Text style={[styles.typeCardDesc, accountType === 'pro' && styles.typeCardDescSelected]}>
                Je loue dans un cadre professionnel
              </Text>
              {accountType === 'pro' && (
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          </View>

          {accountType === 'pro' && (
            <View style={styles.sirenSection}>
              <Text style={styles.sirenLabel}>Numéro SIREN</Text>
              <View style={styles.sirenInputRow}>
                <Ionicons name="business-outline" size={18} color="#A8A8A0" style={styles.sirenIcon} />
                <TextInput
                  style={styles.sirenInput}
                  placeholder="000 000 000"
                  placeholderTextColor="#A8A8A0"
                  value={siren}
                  onChangeText={handleSirenChange}
                  keyboardType="numeric"
                  maxLength={11}
                  autoCorrect={false}
                />
                {siren.replace(/\s/g, '').length === 9 && validateSiren(siren) && (
                  <View style={styles.sirenCheckBadge}>
                    <Text style={styles.sirenCheckText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sirenHint}>
                Le SIREN est un identifiant à 9 chiffres attribué par l'INSEE à chaque entreprise.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, (!accountType || submitting) && { opacity: 0.55 }]}
            onPress={handleContinue}
            disabled={!accountType || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Continuer</Text>
            }
          </TouchableOpacity>
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
    paddingBottom: 8,
    gap: 20,
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    top: 60,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    width: 28,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 20,
    maxWidth: 430,
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
    marginTop: -8,
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
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F2F5EC',
  },
  typeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  typeIconCircleSelected: {
    backgroundColor: Colors.primary,
  },
  typeCardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
    textAlign: 'center',
  },
  typeCardTitleSelected: {
    color: '#3A4A2A',
  },
  typeCardDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  typeCardDescSelected: {
    color: '#6A7A5A',
  },
  checkIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  sirenSection: {
    gap: 8,
  },
  sirenLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    marginLeft: 4,
  },
  sirenInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    height: 54,
    paddingHorizontal: 22,
    gap: 10,
  },
  sirenIcon: {
    flexShrink: 0,
  },
  sirenInput: {
    flex: 1,
    height: '100%',
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: Colors.text,
    letterSpacing: 2,
  },
  sirenCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sirenCheckText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  sirenHint: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    lineHeight: 16,
    marginLeft: 4,
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
});
