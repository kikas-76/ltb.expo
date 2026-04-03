import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import SuccessOverlay from '@/components/listing/SuccessOverlay';

const COMMISSION = 0.08;
const TOTAL_STEPS = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Step = 'DETAILS' | 'CATEGORY' | 'PHOTOS' | 'PRICING';
const STEPS: Step[] = ['DETAILS', 'CATEGORY', 'PHOTOS', 'PRICING'];

const STEP_LABELS: Record<Step, string> = {
  DETAILS: 'Étape 1 sur 4 — Votre objet',
  CATEGORY: 'Étape 2 sur 4 — Catégorie',
  PHOTOS: 'Étape 3 sur 4 — Photos',
  PRICING: 'Étape 4 sur 4 — Tarif',
};

const STEP_TITLES_CREATE: Record<Step, string> = {
  DETAILS: 'Créer une annonce',
  CATEGORY: 'Choisissez une catégorie',
  PHOTOS: 'Mettez votre objet en valeur',
  PRICING: 'Définissez votre prix',
};

const STEP_TITLES_EDIT: Record<Step, string> = {
  DETAILS: 'Modifier l\'annonce',
  CATEGORY: 'Choisissez une catégorie',
  PHOTOS: 'Mettez votre objet en valeur',
  PRICING: 'Définissez votre prix',
};

const STEP_SUBTITLES: Record<Step, string> = {
  DETAILS: 'Quel objet souhaitez-vous louer ?',
  CATEGORY: 'Référencer votre annonce',
  PHOTOS: 'Ajoutez des photos',
  PRICING: 'Déterminez le prix et vérifiez votre annonce',
};

const CATEGORY_ICONS: Record<string, { iconName: string; bg: string; iconColor: string }> = {
  electronique: { iconName: 'tv-outline', bg: '#D6E8FF', iconColor: '#4A7EC7' },
  bricolage: { iconName: 'construct-outline', bg: '#D6EDD6', iconColor: '#4A8C4A' },
  sport: { iconName: 'barbell-outline', bg: '#FFE8D6', iconColor: '#C07840' },
  maison: { iconName: 'home-outline', bg: '#F5E8C8', iconColor: '#A07830' },
  evenementiel: { iconName: 'sparkles-outline', bg: '#FFE8F5', iconColor: '#C050A0' },
  vetements: { iconName: 'shirt-outline', bg: '#FFD6D6', iconColor: '#B85050' },
  enfants: { iconName: 'happy-outline', bg: '#EDD6FF', iconColor: '#8050B8' },
  autre: { iconName: 'cube-outline', bg: '#E8E5D8', iconColor: '#7A7A6A' },
};
const DEFAULT_CAT_ICON = { iconName: 'cube-outline', bg: '#E8E5D8', iconColor: '#7A7A6A' };

interface Category {
  id: string;
  name: string;
  value: string;
}

interface PhotoItem {
  uri: string;
  file?: File;
  uploadedUrl?: string;
}

export default function CreateListingScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditMode = !!editId;

  const [step, setStep] = useState<Step>('DETAILS');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditMode);
  const [showSuccess, setShowSuccess] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex + 1) / TOTAL_STEPS;
  const isPricingStep = step === 'PRICING';

  const STEP_TITLES = isEditMode ? STEP_TITLES_EDIT : STEP_TITLES_CREATE;

  useEffect(() => {
    if (isEditMode) {
      loadExistingListing();
    }
  }, [editId]);

  const loadExistingListing = async () => {
    setLoadingEdit(true);
    const { data } = await supabase
      .from('listings')
      .select(`id, name, description, price, deposit_amount, photos_url,
        category:categories!listings_category_id_fkey(id, name, value)`)
      .eq('id', editId)
      .maybeSingle();

    if (data) {
      setName(data.name ?? '');
      setDescription(data.description ?? '');
      setPrice(data.price != null ? String(data.price) : '');
      setDeposit(data.deposit_amount ? String(data.deposit_amount) : '');

      const cat = Array.isArray(data.category) ? data.category[0] : data.category;
      if (cat) setSelectedCategory(cat as Category);

      if (data.photos_url && data.photos_url.length > 0) {
        setPhotos(
          (data.photos_url as string[]).map((url) => ({ uri: url, uploadedUrl: url }))
        );
      }
    }
    setLoadingEdit(false);
  };

  useEffect(() => {
    if (step === 'CATEGORY' && categories.length === 0) {
      loadCategories();
    }
  }, [step]);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('id, name, value')
      .order('order');
    setCategories(data ?? []);
    setCategoriesLoading(false);
  };

  const canAdvance = () => {
    if (step === 'DETAILS') return name.trim().length >= 3 && description.trim().length >= 10;
    if (step === 'CATEGORY') return selectedCategory !== null;
    if (step === 'PHOTOS') return photos.length >= 1;
    if (step === 'PRICING') return price.trim() !== '' && parseFloat(price) > 0;
    return false;
  };

  const goNext = () => {
    setError(null);
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const goBack = () => {
    setError(null);
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
    else router.back();
  };

  const handlePickPhoto = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e: any) => {
        const files: File[] = Array.from(e.target.files ?? []);
        const newItems: PhotoItem[] = files.map((file) => ({
          uri: URL.createObjectURL(file),
          file,
        }));
        setPhotos((prev) => [...prev, ...newItems].slice(0, 10));
      };
      input.click();
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError("L'accès à la galerie est requis pour ajouter des photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 10 - photos.length,
      });
      if (!result.canceled && result.assets.length > 0) {
        const newItems: PhotoItem[] = result.assets.map((asset) => ({
          uri: asset.uri,
        }));
        setPhotos((prev) => [...prev, ...newItems].slice(0, 10));
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return urls;

    for (const photo of photos) {
      if (photo.uploadedUrl) { urls.push(photo.uploadedUrl); continue; }

      const ext = photo.file
        ? (photo.file.name.split('.').pop() ?? 'jpg')
        : (photo.uri.split('.').pop()?.split('?')[0] ?? 'jpg');
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      if (Platform.OS === 'web' && photo.file) {
        const { data, error: upErr } = await supabase.storage
          .from('listing-photos')
          .upload(path, photo.file, { contentType: photo.file.type });
        if (!upErr && data) {
          const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(data.path);
          urls.push(urlData.publicUrl);
        }
      } else {
        const formData = new FormData();
        formData.append('file', {
          uri: photo.uri,
          name: `photo.${ext}`,
          type: `image/${ext}`,
        } as any);
        const { data, error: upErr } = await supabase.storage
          .from('listing-photos')
          .upload(path, formData, { contentType: `image/${ext}` });
        if (!upErr && data) {
          const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(data.path);
          urls.push(urlData.publicUrl);
        }
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Vous devez être connecté pour continuer.');
      setSubmitting(false);
      return;
    }
    let photoUrls: string[] = [];
    if (photos.length > 0) photoUrls = await uploadPhotos();
    const priceNum = parseFloat(price);
    const depositNum = parseFloat(deposit) || 0;

    if (isEditMode) {
      const { error: updateError } = await supabase.from('listings').update({
        name: name.trim(),
        description: description.trim(),
        category_id: selectedCategory?.id ?? null,
        category_name: selectedCategory?.name ?? null,
        price: priceNum,
        deposit_amount: depositNum,
        photos_url: photoUrls,
      }).eq('id', editId);
      setSubmitting(false);
      if (updateError) { setError(updateError.message); return; }
      setShowSuccess(true);
      setTimeout(() => router.replace(`/listing/${editId}` as any), 2600);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('location_data')
      .eq('id', user.id)
      .maybeSingle();
    const lat = profileData?.location_data?.lat ?? null;
    const lng = profileData?.location_data?.lng ?? null;

    const { error: insertError } = await supabase.from('listings').insert({
      owner_id: user.id,
      name: name.trim(),
      description: description.trim(),
      category_id: selectedCategory?.id ?? null,
      category_name: selectedCategory?.name ?? null,
      price: priceNum,
      deposit_amount: depositNum,
      photos_url: photoUrls,
      is_active: true,
      latitude: lat,
      longitude: lng,
    });
    setSubmitting(false);
    if (insertError) { setError(insertError.message); return; }
    setShowSuccess(true);
    setTimeout(() => router.replace('/(tabs)/mes-annonces'), 2600);
  };

  const priceNum = parseFloat(price) || 0;
  const earningsPerDay = priceNum * (1 - COMMISSION);
  const price3 = priceNum > 0 ? (priceNum * 3 * 0.9).toFixed(2) : null;
  const price7 = priceNum > 0 ? (priceNum * 7 * 0.8).toFixed(2) : null;
  const earnings3 = priceNum > 0 ? (priceNum * 3 * 0.9 * (1 - COMMISSION)).toFixed(2) : null;
  const earnings7 = priceNum > 0 ? (priceNum * 7 * 0.8 * (1 - COMMISSION)).toFixed(2) : null;

  const catStyle = selectedCategory
    ? (CATEGORY_ICONS[selectedCategory.value] ?? DEFAULT_CAT_ICON)
    : null;

  if (loadingEdit) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement de l'annonce…</Text>
      </View>
    );
  }

  return (
    <>
    <SuccessOverlay visible={showSuccess} isEditMode={isEditMode} listingName={name.trim()} />
    <KeyboardAvoidingView
      style={[styles.flex, isPricingStep && styles.flexPricing]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, isPricingStep && styles.containerPricing]}>
        {/* Header */}
        <View style={[styles.header, isPricingStep && styles.headerPricing]}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stepLabel, isPricingStep && styles.stepLabelPricing]}>
            {STEP_LABELS[step]}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, isPricingStep && styles.progressTrackPricing]}>
          <View style={[styles.progressFill, isPricingStep && styles.progressFillPricing, { width: `${progress * 100}%` }]} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, isPricingStep && styles.scrollContentPricing]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.stepTitle, isPricingStep && styles.stepTitlePricing]}>
            {STEP_TITLES[step]}
          </Text>
          <Text style={[styles.stepSubtitle, isPricingStep && styles.stepSubtitlePricing]}>
            {STEP_SUBTITLES[step]}
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* STEP 1 — DETAILS */}
          {step === 'DETAILS' && (
            <View style={styles.formSection}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Nom de l'objet</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Perceuse Bosch professionnelle"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  maxLength={80}
                />
                <Text style={styles.charCount}>{name.length}/80</Text>
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={styles.textarea}
                  placeholder="Décrivez votre objet : état, utilisation, accessoires inclus..."
                  placeholderTextColor={Colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  maxLength={500}
                />
                <Text style={styles.charCount}>{description.length}/500</Text>
              </View>
              <View style={styles.tipsBox}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.tipsText}>
                  Un titre précis et une bonne description multiplient vos chances de location.
                </Text>
              </View>
            </View>
          )}

          {/* STEP 2 — CATEGORY */}
          {step === 'CATEGORY' && (
            <View style={styles.formSection}>
              {categoriesLoading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={Colors.primary} />
                </View>
              ) : (
                <View style={styles.categoryGrid}>
                  {categories.map((cat) => {
                    const isSelected = selectedCategory?.id === cat.id;
                    const cs = CATEGORY_ICONS[cat.value] ?? DEFAULT_CAT_ICON;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                        onPress={() => setSelectedCategory(cat)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.categoryIconWrap, { backgroundColor: isSelected ? Colors.primary + '22' : cs.bg }]}>
                          <Ionicons name={cs.iconName as any} size={30} color={isSelected ? Colors.primaryDark : cs.iconColor} />
                        </View>
                        <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
                          {cat.name}
                        </Text>
                        {isSelected && (
                          <View style={styles.categoryCheckBadge}>
                            <Ionicons name="checkmark-outline" size={10} color={Colors.white} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* STEP 3 — PHOTOS */}
          {step === 'PHOTOS' && (
            <View style={styles.formSection}>
              <TouchableOpacity style={styles.photoDropZone} onPress={handlePickPhoto} activeOpacity={0.8}>
                <View style={styles.photoDropIcon}>
                  <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                </View>
                <Text style={styles.photoDropText}>Glissez-déposez vos photos</Text>
                <Text style={styles.photoDropOr}>ou</Text>
                <View style={styles.photoDropBtn}>
                  <Text style={styles.photoDropBtnText}>Ajouter des photos</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.photoInfoBox}>
                <Ionicons name="information-circle-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.photoInfoText}>
                  Ajoutez au moins 1 photo.{'\n'}Les annonces avec photos reçoivent plus de demandes
                </Text>
              </View>

              {photos.length > 0 && (
                <>
                  <View style={styles.photoCountRow}>
                    <Text style={styles.photoCountLabel}>Photos ajoutées</Text>
                    <View style={styles.photoCountPill}>
                      <Text style={styles.photoCountPillText}>{photos.length}/10</Text>
                    </View>
                  </View>
                  <View style={styles.photoGrid}>
                    {photos.map((photo, index) => (
                      <View key={index} style={[styles.photoCell, index === 0 && styles.photoCellMain]}>
                        <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                        {index === 0 && (
                          <View style={styles.photoPrimaryBadge}>
                            <Text style={styles.photoPrimaryText}>Photo principale</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.photoRemoveBtn}
                          onPress={() => removePhoto(index)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="close-outline" size={12} color={Colors.text} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {photos.length < 10 && (
                      <TouchableOpacity style={styles.photoAddCell} onPress={handlePickPhoto} activeOpacity={0.7}>
                        <Ionicons name="add-outline" size={22} color={Colors.primary} />
                        <Text style={styles.photoAddText}>Ajouter</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

          {/* STEP 4 — PRICING */}
          {step === 'PRICING' && (
            <View style={styles.formSection}>
              {/* Price inputs card */}
              <View style={styles.pricingCard}>
                <Text style={styles.pricingFieldLabel}>Tarif affiché par jour</Text>
                <View style={styles.pricingInputRow}>
                  <TextInput
                    style={styles.pricingInput}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    value={price}
                    onChangeText={(v) => setPrice(v.replace(',', '.'))}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.pricingEuroWrap}>
                    <Text style={styles.pricingEuroText}>€</Text>
                  </View>
                </View>
                <Text style={styles.pricingHint}>Ce prix inclut notre commission de 8%</Text>

                <View style={styles.pricingDivider} />

                <Text style={styles.pricingFieldLabel}>Caution (optionnel)</Text>
                <View style={styles.pricingInputRow}>
                  <TextInput
                    style={styles.pricingInput}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    value={deposit}
                    onChangeText={(v) => setDeposit(v.replace(',', '.'))}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.pricingEuroWrap}>
                    <Text style={styles.pricingEuroText}>€</Text>
                  </View>
                </View>

                <View style={styles.cautionInfoBox}>
                  <Ionicons name="information-circle-outline" size={13} color={Colors.primaryDark} />
                  <Text style={styles.cautionInfoText}>
                    Caution recommandée : 30% à 50% de la valeur de l'objet
                  </Text>
                </View>

                {(!deposit || parseFloat(deposit) === 0) && (
                  <View style={styles.cautionWarnBox}>
                    <Ionicons name="warning-outline" size={13} color='#A07830' />
                    <Text style={styles.cautionWarnText}>
                      Une caution nulle augmente le nombre de locations
                    </Text>
                  </View>
                )}
              </View>

              {/* Revenue projection */}
              {priceNum > 0 && (
                <View style={styles.revenueSection}>
                  <View style={styles.revenueTitleRow}>
                    <Ionicons name="trending-up-outline" size={16} color={Colors.primaryDark} />
                    <Text style={styles.revenueTitle}>Projection de revenus</Text>
                  </View>
                  <Text style={styles.revenueSubtitle}>
                    Ce que vous recevez réellement après commission de 8%
                  </Text>

                  <View style={styles.revenueGrid}>
                    <View style={styles.revenueCard}>
                      <Text style={styles.revenueCardLabel}>1 jour</Text>
                      <Text style={styles.revenueCardAmount}>{earningsPerDay.toFixed(2)} €</Text>
                      <Text style={styles.revenueCardSub}>affiché {priceNum.toFixed(2)} €</Text>
                    </View>
                    <View style={styles.revenueCard}>
                      <View style={styles.revenueCardBadge}>
                        <Ionicons name="pricetag-outline" size={9} color={Colors.primaryDark} />
                        <Text style={styles.revenueCardBadgeText}>-10%</Text>
                      </View>
                      <Text style={styles.revenueCardLabel}>3 jours</Text>
                      <Text style={styles.revenueCardAmount}>{earnings3} €</Text>
                      <Text style={styles.revenueCardSub}>affiché {price3} €</Text>
                    </View>
                    <View style={[styles.revenueCard, styles.revenueCardHighlight]}>
                      <View style={[styles.revenueCardBadge, styles.revenueCardBadgeDark]}>
                        <Ionicons name="pricetag-outline" size={9} color={Colors.white} />
                        <Text style={[styles.revenueCardBadgeText, { color: Colors.white }]}>-20%</Text>
                      </View>
                      <Text style={[styles.revenueCardLabel, { color: Colors.white }]}>7 jours</Text>
                      <Text style={[styles.revenueCardAmount, { color: Colors.white }]}>{earnings7} €</Text>
                      <Text style={[styles.revenueCardSub, { color: 'rgba(255,255,255,0.65)' }]}>affiché {price7} €</Text>
                    </View>
                  </View>

                  <View style={styles.commissionNote}>
                    <Ionicons name="information-circle-outline" size={13} color={Colors.primaryDark} />
                    <Text style={styles.commissionNoteText}>
                      Sans commission de notre part, vous toucheriez{' '}
                      <Text style={styles.commissionNoteHighlight}>{priceNum.toFixed(2)} € / jour</Text>
                      . Proposer un tarif compétitif reste votre meilleur levier.
                    </Text>
                  </View>
                </View>
              )}

              {/* Preview card */}
              {priceNum > 0 && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewSectionLabel}>Aperçu de votre annonce</Text>
                  <View style={styles.previewCard}>
                    {photos.length > 0 && (
                      <Image
                        source={{ uri: photos[0].uri }}
                        style={styles.previewPhoto}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.previewBody}>
                      {selectedCategory && catStyle && (
                        <View style={styles.previewCatRow}>
                          <View style={[styles.previewCatIconWrap, { backgroundColor: catStyle.bg }]}>
                            <Ionicons name={(catStyle as any).iconName} size={13} color={catStyle.iconColor} />
                          </View>
                          <Text style={styles.previewCatLabel}>{selectedCategory.name}</Text>
                        </View>
                      )}
                      <Text style={styles.previewName}>{name || 'Nom de l\'objet'}</Text>
                      <Text style={styles.previewPrice}>
                        {priceNum.toFixed(2)}{' '}
                        <Text style={styles.previewPriceUnit}>€ / jour</Text>
                      </Text>

                      {price3 && price7 && (
                        <View style={styles.previewDiscounts}>
                          <View style={styles.previewDiscountRow}>
                            <Text style={styles.previewDiscountDays}>3 jours</Text>
                            <Text style={styles.previewDiscountAmount}>{price3} €</Text>
                            <View style={styles.previewDiscountBadge}>
                              <Ionicons name="pricetag-outline" size={9} color='#A07830' />
                              <Text style={styles.previewDiscountPct}>-10%</Text>
                            </View>
                          </View>
                          <View style={styles.previewDiscountDivider} />
                          <View style={styles.previewDiscountRow}>
                            <Text style={styles.previewDiscountDays}>7 jours</Text>
                            <Text style={styles.previewDiscountAmount}>{price7} €</Text>
                            <View style={styles.previewDiscountBadge}>
                              <Ionicons name="pricetag-outline" size={9} color='#A07830' />
                              <Text style={styles.previewDiscountPct}>-20%</Text>
                            </View>
                          </View>
                          <Text style={styles.previewDiscountNote}>
                            Réductions automatiques selon la durée
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, isPricingStep && styles.footerPricing]}>
          {step !== 'PRICING' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, !canAdvance() && styles.primaryBtnDisabled]}
              onPress={goNext}
              disabled={!canAdvance()}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continuer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, styles.publishBtn, (!canAdvance() || submitting) && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canAdvance() || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={[styles.primaryBtnText, styles.publishBtnText]}>
                  {isEditMode ? 'Enregistrer les modifications' : 'Publier mon annonce'}
                </Text>
              )}
            </TouchableOpacity>
          )}
          <Text style={[styles.footerHint, isPricingStep && styles.footerHintPricing]}>
            {getFooterHint(step)}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
    </>
  );
}

function getFooterHint(step: Step): string {
  if (step === 'DETAILS') return 'Décrivez clairement votre objet pour attirer les locataires';
  if (step === 'CATEGORY') return 'Choisissez la catégorie pour aider les locataires à vous trouver';
  if (step === 'PHOTOS') return 'Vous pourrez modifier les photos plus tard';
  return 'Vous pourrez modifier le prix après publication';
}

const PHOTO_CELL_SIZE = (SCREEN_WIDTH - 40 - 8) / 3;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flexPricing: {
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  containerPricing: {
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  headerPricing: {
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  stepLabelPricing: {
    color: Colors.textMuted,
  },
  headerSpacer: {
    width: 36,
  },

  /* Progress */
  progressTrack: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    marginHorizontal: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressTrackPricing: {
    backgroundColor: Colors.borderLight,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressFillPricing: {
    backgroundColor: Colors.primary,
  },

  /* Scroll */
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  scrollContentPricing: {
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  stepTitlePricing: {
    color: Colors.text,
  },
  stepSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  stepSubtitlePricing: {
    color: Colors.textSecondary,
  },

  errorBox: {
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },

  formSection: {
    gap: 16,
  },

  /* Details */
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
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
  textarea: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 140,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: Colors.text,
    lineHeight: 22,
  },
  charCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  tipsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryLight + '35',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  tipsText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.primaryDark,
    lineHeight: 18,
  },

  /* Category */
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 3 },
      web: { boxShadow: '0 3px 10px rgba(0,0,0,0.07)' },
    }),
  },
  categoryCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight + '35',
  },
  categoryIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 18,
  },
  categoryNameSelected: {
    color: Colors.primaryDark,
    fontFamily: 'Inter-SemiBold',
  },
  categoryCheckBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Photos */
  photoDropZone: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  photoDropIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  photoDropText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  photoDropOr: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  photoDropBtn: {
    backgroundColor: Colors.primary + '25',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
  },
  photoDropBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.primaryDark,
  },
  photoInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryLight + '35',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  photoInfoText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.primaryDark,
    lineHeight: 18,
  },
  photoCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  photoCountLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  photoCountPill: {
    backgroundColor: Colors.primary + '25',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  photoCountPillText: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCell: {
    width: PHOTO_CELL_SIZE,
    height: PHOTO_CELL_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.borderLight,
  },
  photoCellMain: {
    width: '100%',
    height: 200,
    borderRadius: 18,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPrimaryBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoPrimaryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddCell: {
    width: PHOTO_CELL_SIZE,
    height: PHOTO_CELL_SIZE,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.primary + '60',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.primary,
  },

  /* Pricing */
  pricingCard: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.07)' },
    }),
  },
  pricingFieldLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pricingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  pricingInput: {
    flex: 1,
    height: 54,
    paddingHorizontal: 18,
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
  },
  pricingEuroWrap: {
    paddingHorizontal: 18,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  pricingEuroText: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.textSecondary,
  },
  pricingHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 6,
  },
  cautionInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primaryLight + '30',
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  cautionInfoText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.primaryDark,
    lineHeight: 17,
  },
  cautionWarnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F5D06A80',
  },
  cautionWarnText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#A07830',
    lineHeight: 17,
  },

  /* Revenue */
  revenueSection: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 18,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
      web: { boxShadow: '0 4px 14px rgba(0,0,0,0.12)' },
    }),
  },
  revenueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  revenueSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: -6,
  },
  revenueGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  revenueCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 3,
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  revenueCardHighlight: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  revenueCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.primaryLight + '50',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    top: 8,
    right: 8,
  },
  revenueCardBadgeDark: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  revenueCardBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 9,
    color: Colors.primaryDark,
  },
  revenueCardLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 14,
  },
  revenueCardAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  revenueCardSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: Colors.textMuted,
  },
  commissionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primaryLight + '30',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '35',
  },
  commissionNoteText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.primaryDark,
    lineHeight: 17,
  },
  commissionNoteHighlight: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
  },

  /* Preview */
  previewSection: {
    gap: 10,
    marginBottom: 8,
  },
  previewSectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
      web: { boxShadow: '0 4px 14px rgba(0,0,0,0.12)' },
    }),
  },
  previewPhoto: {
    width: '100%',
    height: 180,
  },
  previewBody: {
    padding: 16,
    gap: 6,
  },
  previewCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  previewCatIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCatLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  previewName: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  previewPrice: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: '#A07830',
    marginTop: 2,
  },
  previewPriceUnit: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#A07830',
  },
  previewDiscounts: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewDiscountDays: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
    width: 50,
  },
  previewDiscountAmount: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  previewDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF0D0',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  previewDiscountPct: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#A07830',
  },
  previewDiscountDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  previewDiscountNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
    gap: 8,
  },
  footerPricing: {
    backgroundColor: Colors.background,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtn: {
    backgroundColor: Colors.primary,
  },
  primaryBtnDisabled: {
    opacity: 0.35,
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.white,
    letterSpacing: 0.1,
  },
  publishBtnText: {
    color: Colors.white,
  },
  footerHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerHintPricing: {
    color: Colors.textMuted,
  },
});
