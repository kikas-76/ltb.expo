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
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';


const BUSINESS_TYPES = [
  { label: 'Magasin de location', icon: 'storefront-outline' },
  { label: 'Auto-entrepreneur', icon: 'briefcase-outline' },
  { label: 'Artisan / Bricolage', icon: 'build-outline' },
  { label: 'Restauration', icon: 'restaurant-outline' },
  { label: 'Sport & Loisirs', icon: 'barbell-outline' },
  { label: 'Culture & Éducation', icon: 'book-outline' },
  { label: 'Automobile', icon: 'car-outline' },
  { label: 'Mode & Textile', icon: 'shirt-outline' },
];

const DAYS = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
  { key: 'sunday', label: 'Dimanche' },
];

type DayHours = { open: string; close: string; closed: boolean };
type WeekHours = Record<string, DayHours>;

const DEFAULT_HOURS: WeekHours = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '09:00', close: '17:00', closed: false },
  sunday: { open: '10:00', close: '13:00', closed: true },
};

function Stepper({ active }: { active: number }) {
  return (
    <View style={styles.stepper}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={[styles.stepDot, active === n && styles.stepDotActive]} />
      ))}
    </View>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) {
      onChange(digits);
    } else {
      onChange(`${digits.slice(0, 2)}:${digits.slice(2)}`);
    }
  };

  return (
    <TextInput
      style={styles.timeInput}
      value={value}
      onChangeText={handleChange}
      placeholder="00:00"
      placeholderTextColor="#C0B8A8"
      keyboardType="numeric"
      maxLength={5}
    />
  );
}

export default function BusinessHoursScreen() {
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [hours, setHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateDay = (dayKey: string, field: keyof DayHours, value: string | boolean) => {
    setHours((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], [field]: value },
    }));
  };

  const handleSave = async () => {
    setError(null);

    if (!businessType) {
      setError('Veuillez sélectionner un type de commerce.');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Session expirée. Veuillez recommencer.');
      setSubmitting(false);
      return;
    }

    const updates: Record<string, any> = {
      business_hours: hours,
      business_type: businessType,
      business_name: businessName.trim() || null,
    };

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (updateError) {
      setError('Erreur lors de la sauvegarde : ' + updateError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.replace('/onboarding/welcome');
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
          <Stepper active={5} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Votre commerce</Text>
          <Text style={styles.subtitle}>
            Ces informations seront affichées sur votre profil professionnel
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nom du commerce (facultatif)</Text>
            <View style={styles.inputRow}>
              <Ionicons name="storefront-outline" size={18} color="#A8A8A0" />
              <TextInput
                style={styles.inputFlex}
                placeholder="Ex: Atelier Dupont, Location Pro..."
                placeholderTextColor="#A8A8A0"
                value={businessName}
                onChangeText={setBusinessName}
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Type d'activité</Text>
            <TouchableOpacity
              style={[styles.inputRow, businessType && styles.inputRowSelected]}
              onPress={() => setShowTypeSelector(!showTypeSelector)}
              activeOpacity={0.85}
            >
              <Ionicons name="briefcase-outline" size={18} color={businessType ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.inputFlex, { color: businessType ? Colors.text : Colors.textMuted, paddingVertical: 0, height: undefined }]}>
                {businessType ?? 'Sélectionner un type...'}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color="#A8A8A0" />
            </TouchableOpacity>

            {showTypeSelector && (
              <View style={styles.typeDropdown}>
                {BUSINESS_TYPES.map((t) => {
                  const selected = businessType === t.label;
                  return (
                    <TouchableOpacity
                      key={t.label}
                      style={[styles.typeOption, selected && styles.typeOptionSelected]}
                      onPress={() => { setBusinessType(t.label); setShowTypeSelector(false); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={t.icon as any} size={16} color={selected ? Colors.primary : Colors.textSecondary} />
                      <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Ionicons name="time-outline" size={16} color="#1C1C18" />
              <Text style={styles.sectionLabel}>Horaires d'ouverture</Text>
            </View>

            <View style={styles.hoursCard}>
              {DAYS.map((day, idx) => {
                const dayHours = hours[day.key];
                return (
                  <View key={day.key} style={[styles.dayRow, idx < DAYS.length - 1 && styles.dayRowBorder]}>
                    <View style={styles.dayLabelWrap}>
                      <Text style={styles.dayLabel}>{day.label}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.closedToggle, dayHours.closed && styles.closedToggleActive]}
                      onPress={() => updateDay(day.key, 'closed', !dayHours.closed)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.closedToggleText, dayHours.closed && styles.closedToggleTextActive]}>
                        {dayHours.closed ? 'Fermé' : 'Ouvert'}
                      </Text>
                    </TouchableOpacity>

                    {!dayHours.closed && (
                      <View style={styles.timeRange}>
                        <TimeInput
                          value={dayHours.open}
                          onChange={(v) => updateDay(day.key, 'open', v)}
                        />
                        <Text style={styles.timeSeparator}>–</Text>
                        <TimeInput
                          value={dayHours.close}
                          onChange={(v) => updateDay(day.key, 'close', v)}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, submitting && { opacity: 0.65 }]}
            onPress={handleSave}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Terminer l'inscription</Text>
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
    paddingTop: 28,
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
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    marginLeft: 2,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 54,
    paddingHorizontal: 22,
    gap: 10,
  },
  inputRowSelected: {
    borderColor: Colors.primary,
  },
  inputFlex: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: Colors.text,
  },
  typeDropdown: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  typeOptionSelected: {
    backgroundColor: '#F2F5EC',
  },
  typeOptionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
  },
  typeOptionTextSelected: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.primary,
  },
  hoursCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  dayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dayLabelWrap: {
    width: 76,
  },
  dayLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  closedToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  closedToggleActive: {
    backgroundColor: '#F5EDE8',
    borderColor: '#D9A99A',
  },
  closedToggleText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },
  closedToggleTextActive: {
    color: Colors.error,
  },
  timeRange: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  timeInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    width: 56,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeSeparator: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
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
