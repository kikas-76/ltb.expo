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

export type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'nearest';
export type OwnerType = 'all' | 'particulier' | 'professionnel';
export type LocationMode = 'around_me' | 'city';

export const CITIES: { label: string; value: string; lat: number; lng: number }[] = [
  { label: 'Lyon', value: 'lyon', lat: 45.7640, lng: 4.8357 },
  { label: 'Reims', value: 'reims', lat: 49.2583, lng: 4.0317 },
  { label: 'Rouen', value: 'rouen', lat: 49.4432, lng: 1.0993 },
];

export interface FilterState {
  sortKey: SortKey;
  ownerType: OwnerType;
  locationMode: LocationMode;
  selectedCity: string;
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
  locationMode: 'around_me',
  selectedCity: 'lyon',
  priceMin: '',
  priceMax: '',
};

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.sortKey !== 'recent' ||
    f.ownerType !== 'all' ||
    f.priceMin !== '' ||
    f.priceMax !== ''
  );
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Plus récentes' },
  { key: 'nearest', label: 'Plus proches' },
  { key: 'price_asc', label: 'Prix croissant' },
  { key: 'price_desc', label: 'Prix décroissant' },
];

const CATEGORY_ICONS: Record<string, { iconName: string; bg: string; iconColor: string }> = {
  electronique: { iconName: 'desktop-outline', bg: '#D6E8FF', iconColor: '#4A7EC7' },
  bricolage: { iconName: 'construct-outline', bg: '#D6EDD6', iconColor: '#4A8C4A' },
  sport: { iconName: 'barbell-outline', bg: '#FFE8D6', iconColor: '#C07840' },
  maison: { iconName: 'home-outline', bg: '#F5E8C8', iconColor: '#A07830' },
  evenementiel: { iconName: 'sparkles-outline', bg: '#FFE8F5', iconColor: '#C050A0' },
  vetements: { iconName: 'shirt-outline', bg: '#FFD6D6', iconColor: '#B85050' },
  enfants: { iconName: 'happy-outline', bg: '#EDD6FF', iconColor: '#8050B8' },
  autre: { iconName: 'cube-outline', bg: '#E8E5D8', iconColor: '#7A7A6A' },
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
  const translateY = useRef(new Animated.Value(700)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 700,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible && (translateY as any)._value === 700) return null;

  const set = (patch: Partial<FilterState>) =>
    onFiltersChange({ ...filters, ...patch });

  const activeCount = [
    filters.sortKey !== 'recent',
    filters.ownerType !== 'all',
    filters.priceMin !== '' || filters.priceMax !== '',
    selectedCategoryIds.length > 0,
  ].filter(Boolean).length;

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}>
        <View style={styles.handleBar} />

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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ZONE DE RECHERCHE — EN PREMIER */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionLabel}>Zone de recherche</Text>
            </View>
            <View style={styles.locationToggle}>
              <TouchableOpacity
                style={[
                  styles.locationTab,
                  filters.locationMode === 'around_me' && styles.locationTabActive,
                ]}
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
                  <Ionicons name="checkmark-outline" size={15} color={Colors.primary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.locationTab,
                  filters.locationMode === 'city' && styles.locationTabActive,
                ]}
                onPress={() => set({ locationMode: 'city' })}
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
                    Lyon, Reims, Rouen
                  </Text>
                </View>
                {filters.locationMode === 'city' && (
                  <Ionicons name="checkmark-outline" size={15} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {filters.locationMode === 'city' && (
              <View style={styles.cityRow}>
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
                    <Text
                      style={[
                        styles.cityChipText,
                        filters.selectedCity === city.value && styles.cityChipTextActive,
                      ]}
                    >
                      {city.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* TRIER PAR */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionLabel}>Trier par</Text>
            </View>
            <View style={styles.sortGrid}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortCard, filters.sortKey === opt.key && styles.sortCardActive]}
                  onPress={() => set({ sortKey: opt.key })}
                  activeOpacity={0.75}
                >
                  {filters.sortKey === opt.key && (
                    <View style={styles.sortCardCheck}>
                      <Ionicons name="checkmark-outline" size={10} color={Colors.white} />
                    </View>
                  )}
                  <Text style={[styles.sortCardText, filters.sortKey === opt.key && styles.sortCardTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* TYPE D'ANNONCEUR */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionLabel}>Type d'annonceur</Text>
            </View>
            <View style={styles.ownerRow}>
              {[
                { key: 'all' as OwnerType, label: 'Tous', sub: 'Voir tout', iconName: null },
                { key: 'particulier' as OwnerType, label: 'Particulier', sub: 'Non professionnel', iconName: 'person-outline' },
                { key: 'professionnel' as OwnerType, label: 'Pro', sub: 'Certifié', iconName: 'business-outline' },
              ].map(({ key, label, sub, iconName }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.ownerCard, filters.ownerType === key && styles.ownerCardActive]}
                  onPress={() => set({ ownerType: key })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.ownerIconWrap, filters.ownerType === key && styles.ownerIconWrapActive]}>
                    {iconName ? (
                      <Ionicons name={iconName as any} size={16} color={filters.ownerType === key ? Colors.white : Colors.primary} />
                    ) : (
                      <View style={[styles.ownerAllDot, filters.ownerType === key && styles.ownerAllDotActive]} />
                    )}
                  </View>
                  <Text style={[styles.ownerCardText, filters.ownerType === key && styles.ownerCardTextActive]}>
                    {label}
                  </Text>
                  <Text style={[styles.ownerCardSub, filters.ownerType === key && styles.ownerCardSubActive]}>
                    {sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* PRIX */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionLabel}>Budget (€ / jour)</Text>
            </View>
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
                </View>
              </View>
              <View style={styles.priceDivider}>
                <View style={styles.priceDividerLine} />
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
                </View>
              </View>
            </View>

            {filters.priceMin !== '' && filters.priceMax !== '' &&
              Number(filters.priceMin) > Number(filters.priceMax) && (
                <Text style={styles.priceError}>Le minimum doit être inférieur au maximum</Text>
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
            <Text style={styles.resetBtnText}>Réinitialiser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyBtn} onPress={onApply} activeOpacity={0.85}>
            <Text style={styles.applyBtnText}>Voir les résultats</Text>
            <Ionicons name="chevron-forward-outline" size={15} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,18,14,0.5)',
  },
  panel: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
      },
      android: { elevation: 20 },
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
    paddingVertical: 22,
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
    color: Colors.primary,
  },
  cityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cityChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 12,
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
  sortCardCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
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
  ownerAllDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  ownerAllDotActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
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
  priceDivider: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceDividerLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.border,
  },
  priceError: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.error,
    marginTop: 8,
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
    paddingHorizontal: 18,
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
    backgroundColor: Colors.primary,
  },
  applyBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.background,
  },
});
