import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useResponsive } from '@/hooks/useResponsive';

export type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'nearest';
export type OwnerType = 'all' | 'particulier' | 'professionnel';
export type LocationMode = 'around_me' | 'city' | 'none';

export const CITIES: { label: string; value: string; lat: number; lng: number }[] = [
  { label: 'Lyon', value: 'lyon', lat: 45.7640, lng: 4.8357 },
  { label: 'Reims', value: 'reims', lat: 49.2583, lng: 4.0317 },
  { label: 'Rouen', value: 'rouen', lat: 49.4432, lng: 1.0993 },
];

export const RADIUS_OPTIONS: { label: string; value: number }[] = [
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '30 km', value: 30 },
  { label: '50 km', value: 50 },
  { label: '100 km', value: 100 },
];

export interface FilterState {
  sortKey: SortKey;
  ownerType: OwnerType;
  locationMode: LocationMode;
  selectedCity: string;
  radiusKm: number;
  priceMin: string;
  priceMax: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  value: string;
}

interface FilterPanelProps {
  visible: boolean;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  onClose: () => void;
  onApply: () => void;
  categories?: CategoryOption[];
  selectedCategoryIds?: string[];
  onToggleCategory?: (id: string) => void;
}

export const DEFAULT_FILTERS: FilterState = {
  sortKey: 'recent',
  ownerType: 'all',
  locationMode: 'none',
  selectedCity: '',
  radiusKm: 30,
  priceMin: '',
  priceMax: '',
};

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.sortKey !== 'recent' ||
    f.ownerType !== 'all' ||
    f.locationMode !== 'none' ||
    f.priceMin !== '' ||
    f.priceMax !== ''
  );
}

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'recent', label: 'Plus récentes', icon: 'time-outline' },
  { key: 'nearest', label: 'Plus proches', icon: 'location-outline' },
  { key: 'price_asc', label: 'Prix croissant', icon: 'trending-up-outline' },
  { key: 'price_desc', label: 'Prix décroissant', icon: 'trending-down-outline' },
];

// Keep this map in sync with components/explore/CategoryStrip.tsx — adding a
// new category to the DB requires adding it here too, otherwise the filter
// list falls back to the generic cube icon and several categories collide.
const CATEGORY_ICONS: Record<string, { iconName: string; bg: string; iconColor: string }> = {
  electronique: { iconName: 'desktop-outline',         bg: '#D6E8FF', iconColor: '#4A7EC7' },
  bricolage:    { iconName: 'construct-outline',       bg: '#D6EDD6', iconColor: '#4A8C4A' },
  sport:        { iconName: 'barbell-outline',         bg: '#FFE8D6', iconColor: '#C07840' },
  maison:       { iconName: 'home-outline',            bg: '#F5E8C8', iconColor: '#A07830' },
  evenementiel: { iconName: 'sparkles-outline',        bg: '#FFE8F5', iconColor: '#C050A0' },
  vetements:    { iconName: 'shirt-outline',           bg: '#FFD6D6', iconColor: '#B85050' },
  enfants:      { iconName: 'happy-outline',           bg: '#EDD6FF', iconColor: '#8050B8' },
  mobilite:     { iconName: 'bicycle-outline',         bg: '#D6F0E8', iconColor: '#3A8C6A' },
  hightech:     { iconName: 'game-controller-outline', bg: '#D6E0FF', iconColor: '#4A5EC7' },
  musique:      { iconName: 'musical-notes-outline',   bg: '#FFE8F0', iconColor: '#C04070' },
  cuisine:      { iconName: 'restaurant-outline',      bg: '#FFF0D6', iconColor: '#C08030' },
  camping:      { iconName: 'compass-outline',         bg: '#E0F0D6', iconColor: '#5A9040' },
  pro:          { iconName: 'briefcase-outline',       bg: '#E8E0D6', iconColor: '#8A6A50' },
  autre:        { iconName: 'cube-outline',            bg: '#E8E5D8', iconColor: '#7A7A6A' },
};

const DEFAULT_CATEGORY_ICON = { iconName: 'cube-outline', bg: '#E8E5D8', iconColor: '#7A7A6A' };

export default function FilterPanel({
  visible,
  filters,
  onFiltersChange,
  onClose,
  onApply,
  categories = [],
  selectedCategoryIds = [],
  onToggleCategory,
}: FilterPanelProps) {
  const { isDesktop } = useResponsive();
  const translateY = useRef(new Animated.Value(800)).current;
  const translateX = useRef(new Animated.Value(420)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isRendered = useRef(false);

  useEffect(() => {
    if (visible) {
      isRendered.current = true;
      Animated.parallel([
        Animated.timing(isDesktop ? translateX : translateY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(isDesktop ? translateX : translateY, {
          toValue: isDesktop ? 420 : 800,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, isDesktop]);

  if (!visible && !isRendered.current) return null;

  const set = (patch: Partial<FilterState>) =>
    onFiltersChange({ ...filters, ...patch });

  const activeCount = [
    filters.sortKey !== 'recent',
    filters.ownerType !== 'all',
    filters.priceMin !== '' || filters.priceMax !== '',
    selectedCategoryIds.length > 0,
    filters.locationMode !== 'none',
  ].filter(Boolean).length;

  const priceInvalid =
    filters.priceMin !== '' &&
    filters.priceMax !== '' &&
    Number(filters.priceMin) > Number(filters.priceMax);

  return (
    <View
      style={[styles.overlay, isDesktop && styles.overlayDesktop]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          isDesktop ? styles.panelDesktop : null,
          isDesktop
            ? { transform: [{ translateX }] }
            : { transform: [{ translateY }] },
        ]}
      >
        {!isDesktop && <View style={styles.handleBar} />}

        <View style={styles.panelHeader}>
          <View style={styles.panelTitleRow}>
            <Text style={styles.panelTitle}>Filtres</Text>
            {activeCount > 0 && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>{activeCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close-outline" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ZONE DE RECHERCHE */}
          <View style={styles.section}>
            <SectionLabel label="Zone de recherche" />

            <View style={styles.locationToggle}>
              <TouchableOpacity
                style={[styles.locationTab, filters.locationMode === 'none' && styles.locationTabActive]}
                onPress={() => set({ locationMode: 'none' })}
                activeOpacity={0.8}
              >
                <View style={[styles.locationIconWrap, filters.locationMode === 'none' && styles.locationIconWrapActive]}>
                  <Ionicons name="earth-outline" size={15} color={filters.locationMode === 'none' ? Colors.white : Colors.primary} />
                </View>
                <View style={styles.locationTabContent}>
                  <Text style={[styles.locationTabTitle, filters.locationMode === 'none' && styles.locationTabTitleActive]}>
                    Toute la France
                  </Text>
                  <Text style={[styles.locationTabSub, filters.locationMode === 'none' && styles.locationTabSubActive]}>
                    Sans restriction géographique
                  </Text>
                </View>
                {filters.locationMode === 'none' && (
                  <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.locationTab, filters.locationMode === 'around_me' && styles.locationTabActive]}
                onPress={() => set({ locationMode: 'around_me' })}
                activeOpacity={0.8}
              >
                <View style={[styles.locationIconWrap, filters.locationMode === 'around_me' && styles.locationIconWrapActive]}>
                  <Ionicons name="navigate-outline" size={15} color={filters.locationMode === 'around_me' ? Colors.white : Colors.primary} />
                </View>
                <View style={styles.locationTabContent}>
                  <Text style={[styles.locationTabTitle, filters.locationMode === 'around_me' && styles.locationTabTitleActive]}>
                    Autour de moi
                  </Text>
                  <Text style={[styles.locationTabSub, filters.locationMode === 'around_me' && styles.locationTabSubActive]}>
                    Géolocalisation automatique
                  </Text>
                </View>
                {filters.locationMode === 'around_me' && (
                  <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.locationTab, filters.locationMode === 'city' && styles.locationTabActive]}
                onPress={() => set({ locationMode: 'city', selectedCity: filters.selectedCity || 'lyon' })}
                activeOpacity={0.8}
              >
                <View style={[styles.locationIconWrap, filters.locationMode === 'city' && styles.locationIconWrapActive]}>
                  <Ionicons name="location-outline" size={15} color={filters.locationMode === 'city' ? Colors.white : Colors.primary} />
                </View>
                <View style={styles.locationTabContent}>
                  <Text style={[styles.locationTabTitle, filters.locationMode === 'city' && styles.locationTabTitleActive]}>
                    Choisir une ville
                  </Text>
                  <Text style={[styles.locationTabSub, filters.locationMode === 'city' && styles.locationTabSubActive]}>
                    {CITIES.map((c) => c.label).join(', ')}
                  </Text>
                </View>
                {filters.locationMode === 'city' && (
                  <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {filters.locationMode === 'city' && (
              <View style={styles.cityGrid}>
                {CITIES.map((city) => (
                  <TouchableOpacity
                    key={city.value}
                    style={[
                      styles.cityChip,
                      filters.selectedCity === city.value && styles.cityChipActive,
                    ]}
                    onPress={() => set({ selectedCity: city.value })}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cityChipText, filters.selectedCity === city.value && styles.cityChipTextActive]}>
                      {city.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {filters.locationMode !== 'none' && (
              <View style={styles.radiusSection}>
                <Text style={styles.radiusLabel}>
                  Rayon de recherche
                  <Text style={styles.radiusValue}> — {filters.radiusKm} km</Text>
                </Text>
                <View style={styles.radiusRow}>
                  {RADIUS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.radiusChip, filters.radiusKm === opt.value && styles.radiusChipActive]}
                      onPress={() => set({ radiusKm: opt.value })}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.radiusChipText, filters.radiusKm === opt.value && styles.radiusChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* TRIER PAR */}
          <View style={styles.section}>
            <SectionLabel label="Trier par" />
            <View style={styles.sortGrid}>
              {SORT_OPTIONS.map((opt) => {
                const active = filters.sortKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sortCard, active && styles.sortCardActive]}
                    onPress={() => set({ sortKey: opt.key })}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={14}
                      color={active ? Colors.white : Colors.primary}
                    />
                    <Text style={[styles.sortCardText, active && styles.sortCardTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* TYPE D'ANNONCEUR */}
          <View style={styles.section}>
            <SectionLabel label="Type d'annonceur" />
            <View style={styles.ownerRow}>
              {[
                { key: 'all' as OwnerType, label: 'Tous', sub: 'Voir tout', iconName: 'apps-outline' },
                { key: 'particulier' as OwnerType, label: 'Particulier', sub: 'Non professionnel', iconName: 'person-outline' },
                { key: 'professionnel' as OwnerType, label: 'Pro', sub: 'Certifié', iconName: 'business-outline' },
              ].map(({ key, label, sub, iconName }) => {
                const active = filters.ownerType === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.ownerCard, active && styles.ownerCardActive]}
                    onPress={() => set({ ownerType: key })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.ownerIconWrap, active && styles.ownerIconWrapActive]}>
                      <Ionicons name={iconName as any} size={16} color={active ? Colors.white : Colors.primary} />
                    </View>
                    <Text style={[styles.ownerCardText, active && styles.ownerCardTextActive]}>
                      {label}
                    </Text>
                    <Text style={[styles.ownerCardSub, active && styles.ownerCardSubActive]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* PRIX */}
          <View style={styles.section}>
            <SectionLabel label="Budget (€ / jour)" />
            <View style={styles.priceRow}>
              <View style={[styles.priceInputWrap, filters.priceMin !== '' && styles.priceInputWrapActive]}>
                <Text style={styles.priceLabel}>Min</Text>
                <View style={styles.priceInputInner}>
                  <Ionicons name="cash-outline" size={12} color={Colors.textMuted} />
                  <TextInput
                    style={styles.priceInput}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={filters.priceMin}
                    onChangeText={(v) => set({ priceMin: v.replace(/[^0-9]/g, '') })}
                  />
                  {filters.priceMin !== '' && (
                    <Text style={styles.priceCurrency}>€</Text>
                  )}
                </View>
              </View>
              <View style={styles.priceDivider}>
                <Ionicons name="arrow-forward-outline" size={14} color={Colors.border} />
              </View>
              <View style={[styles.priceInputWrap, filters.priceMax !== '' && styles.priceInputWrapActive]}>
                <Text style={styles.priceLabel}>Max</Text>
                <View style={styles.priceInputInner}>
                  <Ionicons name="cash-outline" size={12} color={Colors.textMuted} />
                  <TextInput
                    style={styles.priceInput}
                    placeholder="∞"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={filters.priceMax}
                    onChangeText={(v) => set({ priceMax: v.replace(/[^0-9]/g, '') })}
                  />
                  {filters.priceMax !== '' && (
                    <Text style={styles.priceCurrency}>€</Text>
                  )}
                </View>
              </View>
            </View>
            {priceInvalid && (
              <View style={styles.priceErrorRow}>
                <Ionicons name="warning-outline" size={13} color={Colors.error} />
                <Text style={styles.priceError}>Le minimum doit être inférieur au maximum</Text>
              </View>
            )}
          </View>

          {categories.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.section}>
                <View style={styles.sectionLabelRow}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.sectionLabel}>Catégories</Text>
                  {selectedCategoryIds.length > 0 && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>{selectedCategoryIds.length}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.categoryGrid}>
                  {categories.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    const catStyle = CATEGORY_ICONS[cat.value] ?? DEFAULT_CATEGORY_ICON;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                        onPress={() => onToggleCategory?.(cat.id)}
                        activeOpacity={0.75}
                      >
                        <View style={[
                          styles.categoryChipIconWrap,
                          { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : catStyle.bg },
                        ]}>
                          <Ionicons
                            name={catStyle.iconName as any}
                            size={13}
                            color={isSelected ? Colors.white : catStyle.iconColor}
                          />
                        </View>
                        <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                          {cat.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-outline" size={13} color={Colors.white} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>

        <View style={styles.panelFooter}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => onFiltersChange(DEFAULT_FILTERS)}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.resetBtnText}>Réinitialiser</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.applyBtn, priceInvalid && styles.applyBtnDisabled]}
            onPress={priceInvalid ? undefined : onApply}
            activeOpacity={0.85}
          >
            <Text style={styles.applyBtnText}>Voir les résultats</Text>
            {activeCount > 0 && (
              <View style={styles.applyBadge}>
                <Text style={styles.applyBadgeText}>{activeCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward-outline" size={15} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionDot} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  overlayDesktop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,18,14,0.52)',
  },
  panel: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.14, shadowRadius: 20 },
      android: { elevation: 20 },
      web: { boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' } as any,
    }),
  },
  panelDesktop: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '100%',
    width: 400,
    flexShrink: 0,
    ...Platform.select({
      web: { boxShadow: '-4px 0 32px rgba(0,0,0,0.13)' } as any,
    }),
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 19,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  activeBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  activeBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: Colors.white,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 22,
  },
  section: {
    paddingVertical: 20,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: -22,
  },

  /* Location */
  locationToggle: {
    gap: 8,
  },
  locationTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  locationTabActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  locationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIconWrapActive: {
    backgroundColor: Colors.primary,
  },
  locationTabContent: {
    flex: 1,
  },
  locationTabTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  locationTabTitleActive: {
    color: Colors.text,
  },
  locationTabSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  locationTabSubActive: {
    color: Colors.primaryDark,
  },

  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  cityChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cityChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cityChipTextActive: {
    color: Colors.white,
  },

  radiusSection: {
    marginTop: 14,
    gap: 10,
  },
  radiusLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  radiusValue: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  radiusChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  radiusChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  radiusChipTextActive: {
    color: Colors.white,
  },

  /* Sort */
  sortGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: Colors.white,
  },
  sortCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sortCardText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
  },
  sortCardTextActive: {
    color: Colors.white,
  },

  /* Owner */
  ownerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ownerCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    gap: 6,
  },
  ownerCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  ownerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerIconWrapActive: {
    backgroundColor: Colors.primary,
  },
  ownerCardText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.text,
  },
  ownerCardTextActive: {
    color: Colors.text,
  },
  ownerCardSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  ownerCardSubActive: {
    color: Colors.primary,
  },

  /* Price */
  priceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  priceInputWrap: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  priceInputWrapActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  priceLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceInputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceInput: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  priceCurrency: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.textMuted,
  },
  priceDivider: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  priceError: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.error,
  },

  /* Categories */
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.white,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
  },
  categoryChipTextActive: {
    color: Colors.white,
  },

  /* Footer */
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  resetBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.primaryDark,
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
  applyBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: Colors.white,
  },
});
