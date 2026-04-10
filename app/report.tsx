import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';


interface ReportCategory {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const LISTING_CATEGORIES: ReportCategory[] = [
  {
    key: 'fraud',
    label: 'Arnaque / Fraude',
    description: 'Annonce mensongère, demande de paiement suspect',
    icon: <Ionicons name="warning-outline" size={20} color="#C25450" />,
    color: '#C25450',
  },
  {
    key: 'inappropriate_content',
    label: 'Contenu inapproprié',
    description: 'Photos ou texte choquant, offensant ou illégal',
    icon: <Ionicons name="close-circle-outline" size={20} color="#D97706" />,
    color: '#D97706',
  },
  {
    key: 'spam',
    label: 'Spam / Pub',
    description: 'Annonce dupliquée ou contenu publicitaire abusif',
    icon: <Ionicons name="refresh-outline" size={20} color="#7C3AED" />,
    color: '#7C3AED',
  },
  {
    key: 'counterfeit',
    label: 'Contrefaçon',
    description: "Objet contrefait ou droit d'auteur violé",
    icon: <Ionicons name="shield-outline" size={20} color="#B45309" />,
    color: '#B45309',
  },
  {
    key: 'dangerous',
    label: 'Objet dangereux',
    description: 'Objet illégal, dangereux ou réglementé',
    icon: <Ionicons name="flag-outline" size={20} color="#DC2626" />,
    color: '#DC2626',
  },
  {
    key: 'other',
    label: 'Autre raison',
    description: 'Tout autre problème non listé ci-dessus',
    icon: <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />,
    color: '#6B7280',
  },
];

const CONVERSATION_CATEGORIES: ReportCategory[] = [
  {
    key: 'harassment',
    label: 'Harcèlement',
    description: 'Messages insistants, intimidants ou menaçants',
    icon: <Ionicons name="warning-outline" size={20} color="#C25450" />,
    color: '#C25450',
  },
  {
    key: 'fraud',
    label: 'Arnaque / Fraude',
    description: "Tentative d'escroquerie ou de paiement hors plateforme",
    icon: <Ionicons name="shield-outline" size={20} color="#D97706" />,
    color: '#D97706',
  },
  {
    key: 'inappropriate_content',
    label: 'Contenu inapproprié',
    description: 'Messages à caractère offensant ou illégal',
    icon: <Ionicons name="close-circle-outline" size={20} color="#7C3AED" />,
    color: '#7C3AED',
  },
  {
    key: 'spam',
    label: 'Spam',
    description: 'Messages répétitifs ou hors sujet',
    icon: <Ionicons name="refresh-outline" size={20} color="#B45309" />,
    color: '#B45309',
  },
  {
    key: 'no_show',
    label: 'Absence / No-show',
    description: "L'utilisateur n'est pas venu ou ne répond plus",
    icon: <Ionicons name="alert-circle-outline" size={20} color="#6B7280" />,
    color: '#6B7280',
  },
  {
    key: 'other',
    label: 'Autre raison',
    description: 'Tout autre problème non listé ci-dessus',
    icon: <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />,
    color: '#6B7280',
  },
];

export default function ReportScreen() {
  const params = useLocalSearchParams<{ type: string; targetId: string; targetLabel?: string }>();
  const type = params.type as 'listing' | 'conversation';
  const targetId = params.targetId;
  const targetLabel = params.targetLabel ?? '';

  const categories = type === 'conversation' ? CONVERSATION_CATEGORIES : LISTING_CATEGORIES;

  const [step, setStep] = useState<'category' | 'details' | 'done'>('category');
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectCategory = (cat: ReportCategory) => {
    setSelectedCategory(cat);
    setStep('details');
  };

  const handleSubmit = async () => {
    if (!selectedCategory) return;
    setError(null);
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Vous devez être connecté pour signaler.');
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('reports').insert({
      reporter_id: user.id,
      target_type: type,
      target_id: targetId,
      category: selectedCategory.key,
      description: description.trim() || null,
    });

    if (insertError) {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setStep('done');
  };

  const isListing = type !== 'conversation';
  const typeLabel = isListing ? 'l\'annonce' : 'la conversation';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        {step !== 'done' ? (
          <TouchableOpacity
            onPress={() => (step === 'details' ? setStep('category') : router.back())}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerTitleWrap}>
          <Ionicons name="flag-outline" size={16} color={Colors.error} />
          <Text style={styles.headerTitle}>Signaler</Text>
        </View>
      </View>

      {step === 'category' && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>
            Pourquoi signalez-vous {typeLabel}&nbsp;?
          </Text>
          {targetLabel ? (
            <View style={styles.targetChip}>
              <Text style={styles.targetChipText} numberOfLines={1}>{targetLabel}</Text>
            </View>
          ) : null}
          <Text style={styles.pageSubtitle}>
            Votre signalement est anonyme et sera examiné par notre équipe.
          </Text>

          <View style={styles.categoriesList}>
            {categories.map((cat, i) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryCard, i < categories.length - 1 && styles.categoryCardBorder]}
                activeOpacity={0.78}
                onPress={() => handleSelectCategory(cat)}
              >
                <View style={[styles.categoryIconWrap, { backgroundColor: cat.color + '18' }]}>
                  {cat.icon}
                </View>
                <View style={styles.categoryTextWrap}>
                  <Text style={styles.categoryLabel}>{cat.label}</Text>
                  <Text style={styles.categoryDescription}>{cat.description}</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {step === 'details' && selectedCategory && (
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.selectedCatBadge, { backgroundColor: selectedCategory.color + '18', borderColor: selectedCategory.color + '40' }]}>
            {selectedCategory.icon}
            <Text style={[styles.selectedCatBadgeText, { color: selectedCategory.color }]}>
              {selectedCategory.label}
            </Text>
          </View>

          <Text style={styles.pageTitle}>Ajouter des détails</Text>
          <Text style={styles.pageSubtitle}>
            Décrivez le problème pour aider notre équipe à comprendre la situation (facultatif).
          </Text>

          <View style={styles.textAreaWrap}>
            <TextInput
              style={styles.textArea}
              placeholder="Décrivez le problème en détail..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={5}
              value={description}
              onChangeText={setDescription}
              maxLength={600}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/600</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="flag-outline" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Envoyer le signalement</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Les signalements abusifs peuvent entraîner une restriction de votre compte.
          </Text>
        </ScrollView>
      )}

      {step === 'done' && (
        <View style={styles.doneContainer}>
          <View style={styles.doneIconWrap}>
            <Ionicons name="checkmark-circle-outline" size={56} color={Colors.primary} />
          </View>
          <Text style={styles.doneTitle}>Signalement envoyé</Text>
          <Text style={styles.doneSubtitle}>
            Merci pour votre signalement. Notre équipe va l'examiner dans les plus brefs délais.
          </Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'ios' ? 60 : 48,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  scroll: {
    padding: 24,
    paddingTop: 28,
    paddingBottom: 60,
    gap: 16,
  },
  pageTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  targetChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight + '50',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
    marginTop: 4,
  },
  targetChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  pageSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  categoriesList: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  categoryCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryTextWrap: { flex: 1 },
  categoryLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
  },
  categoryDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginTop: 2,
  },
  selectedCatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  selectedCatBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  textAreaWrap: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    position: 'relative',
  },
  textArea: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.text,
    minHeight: 130,
    lineHeight: 22,
  },
  charCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: Colors.error,
    height: 54,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
  },
  disclaimer: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  doneIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  doneTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 999,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#fff',
  },
});
