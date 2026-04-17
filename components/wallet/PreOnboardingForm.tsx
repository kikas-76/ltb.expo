import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

interface PreOnboardingData {
  username: string;
  display_name: string;
  phone_number: string;
  city: string;
  is_pro: boolean;
  business_name: string;
}

interface Props {
  initialData: Partial<PreOnboardingData>;
  userId: string;
  onComplete: () => void;
}

export function PreOnboardingForm({ initialData, userId, onComplete }: Props) {
  const [displayName, setDisplayName] = useState(initialData.display_name ?? '');
  const [phone, setPhone] = useState(initialData.phone_number ?? '');
  const [city, setCity] = useState(initialData.city ?? '');
  const [isPro, setIsPro] = useState(initialData.is_pro ?? false);
  const [businessName, setBusinessName] = useState(initialData.business_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!displayName.trim()) {
      setError('Indique ton prénom et nom légal.');
      return;
    }
    if (!phone.trim()) {
      setError('Indique ton numéro de téléphone.');
      return;
    }
    if (!city.trim()) {
      setError('Indique ta ville.');
      return;
    }
    if (isPro && !businessName.trim()) {
      setError('Indique le nom de ton entreprise.');
      return;
    }

    setSaving(true);
    setError(null);

    const locationDataPatch = city.trim()
      ? { city: city.trim() }
      : undefined;

    const patch: Record<string, unknown> = {
      display_name: displayName.trim(),
      phone_number: phone.trim(),
      is_pro: isPro,
    };

    if (isPro) {
      patch.business_name = businessName.trim();
    }

    if (locationDataPatch) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('location_data')
        .eq('id', userId)
        .maybeSingle();

      patch.location_data = {
        ...(existing?.location_data ?? {}),
        city: city.trim(),
      };
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId);

    setSaving(false);

    if (updateError) {
      setError('Impossible de sauvegarder. Réessaie.');
      return;
    }

    onComplete();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>1 / 2</Text>
        </View>
        <Text style={styles.title}>Quelques infos rapides</Text>
      </View>
      <Text style={styles.subtitle}>
        Ces informations permettent à Stripe de préremplir ton dossier. Tu gagneras du temps dans les étapes suivantes.
      </Text>

      {initialData.username ? (
        <View style={styles.usernameChip}>
          <Text style={styles.usernameChipLabel}>Pseudo public</Text>
          <Text style={styles.usernameChipValue}>@{initialData.username}</Text>
        </View>
      ) : null}

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.label}>Prénom et nom légal</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ex : Marie Dupont"
            placeholderTextColor="#B0ADA0"
            autoCorrect={false}
          />
          <Text style={styles.helperText}>
            Utilisé uniquement pour la vérification Stripe. Ton pseudo @{initialData.username ?? '...'} reste affiché publiquement.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Ex : 06 12 34 56 78"
            placeholderTextColor="#B0ADA0"
            keyboardType="phone-pad"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Ville</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Ex : Lyon"
            placeholderTextColor="#B0ADA0"
            autoCorrect={false}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Je suis un professionnel</Text>
            <Text style={styles.toggleSubLabel}>Entreprise, auto-entrepreneur, etc.</Text>
          </View>
          <Switch
            value={isPro}
            onValueChange={setIsPro}
            trackColor={{ false: '#E0DDD4', true: Colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {isPro && (
          <View style={styles.field}>
            <Text style={styles.label}>Nom de l'entreprise</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Ex : Dupont Location SARL"
              placeholderTextColor="#B0ADA0"
              autoCorrect={false}
            />
          </View>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.submitBtnText}>Continuer vers la vérification →</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 16px rgba(0,0,0,0.06)' } as any : {}),
    borderWidth: 0.5,
    borderColor: '#E8E5D8',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stepBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#6B6B6B',
    lineHeight: 19,
    marginBottom: 20,
  },
  usernameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primarySurface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D9D5C8',
  },
  usernameChipLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6B6B60',
  },
  usernameChipValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  helperText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#8A8A80',
    marginTop: 4,
    lineHeight: 15,
  },
  fields: {
    gap: 14,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0DDD4',
    paddingHorizontal: 14,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.text,
    backgroundColor: '#FAFAF5',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primarySurface,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  toggleSubLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#6B6B6B',
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.error,
    marginTop: 12,
  },
  submitBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
