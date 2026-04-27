import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import ListingCard from '@/components/explore/ListingCard';
import SkeletonCard from '@/components/explore/SkeletonCard';
import CategoryEmptyState from '@/components/explore/CategoryEmptyState';
import FilterPanel, {
  FilterState,
  DEFAULT_FILTERS,
  CITIES,
  SortKey,
} from '@/components/explore/FilterPanel';
import { useResponsive } from '@/hooks/useResponsive';

interface Listing {
  id: string;
  name: string;
  price: number;
  photos_url: string[] | null;
  category_name: string | null;
  category_id: string | null;
  approx_latitude: number | null;
  approx_longitude: number | null;
  owner_type: string | null;
  owner: {
    username: string | null;
    photo_url: string | null;
  } | null;
}

import { haversineKm } from '@/lib/distance';

const SORT_LABEL: Record<SortKey, string> = {
  recent: 'Plus récentes',
  nearest: 'Plus proches',
  price_asc: 'Prix croissant',
  price_desc: 'Prix décroissant',
};

export default function CategoryScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { isDesktop, isTablet } = useResponsive();
  const numColumns = isDesktop ? 4 : isTablet ? 3 : 2;
  const isWide = Platform.OS === 'web' && (isDesktop || isTablet);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showPanel, setShowPanel] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-10)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(18)).current;
  const filterBadgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(contentSlide, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('listings')
        .select(
          'id, name, price, photos_url, category_name, category_id, approx_latitude, approx_longitude, owner_type, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro)'
        )
        .eq('is_active', true)
        .eq('category_id', id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        const mapped: Listing[] = data.map((l: any) => ({
          ...l,
          owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
        }));
        setListings(mapped);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const pulseBadge = () => {
    Animated.sequence([
      Animated.timing(filterBadgeScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(filterBadgeScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleApply = () => {
    setAppliedFilters({ ...filters });
    pulseBadge();
    setShowPanel(false);
  };

  const getRefCoords = (): { lat: number; lng: number } | null => {
    if (appliedFilters.locationMode === 'around_me') return userCoords;
    const city = CITIES.find((c) => c.value === appliedFilters.selectedCity);
    return city ? { lat: city.lat, lng: city.lng } : null;
  };

  const applyClientFilters = (items: Listing[]): Listing[] => {
    let result = [...items];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) => l.name.toLowerCase().includes(q));
    }

    if (appliedFilters.ownerType !== 'all') {
      result = result.filter((l) => l.owner_type === appliedFilters.ownerType);
    }

    if (appliedFilters.priceMin !== '') {
      const min = Number(appliedFilters.priceMin);
      result = result.filter((l) => l.price >= min);
    }
    if (appliedFilters.priceMax !== '') {
      const max = Number(appliedFilters.priceMax);
      result = result.filter((l) => l.price <= max);
    }

    const ref = getRefCoords();
    if (ref) {
      result = result.filter((l) => {
        if (!l.approx_latitude || !l.approx_longitude) return true;
        return haversineKm(ref.lat, ref.lng, l.approx_latitude, l.approx_longitude) <= 30;
      });
    }

    if (appliedFilters.sortKey === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (appliedFilters.sortKey === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (appliedFilters.sortKey === 'nearest' && ref) {
      result.sort((a, b) => {
        const dA =
          a.approx_latitude && a.approx_longitude
            ? haversineKm(ref.lat, ref.lng, a.approx_latitude, a.approx_longitude)
            : 9999;
        const dB =
          b.approx_latitude && b.approx_longitude
            ? haversineKm(ref.lat, ref.lng, b.approx_latitude, b.approx_longitude)
            : 9999;
        return dA - dB;
      });
    }

    return result;
  };

  const filtered = applyClientFilters(listings);
  const activeFiltersCount = [
    appliedFilters.sortKey !== 'recent',
    appliedFilters.ownerType !== 'all',
    appliedFilters.priceMin !== '' || appliedFilters.priceMax !== '',
  ].filter(Boolean).length;

  const locationLabel =
    appliedFilters.locationMode === 'around_me'
      ? 'Autour de moi'
      : CITIES.find((c) => c.value === appliedFilters.selectedCity)?.label ?? '';

  const renderItem = ({ item }: { item: Listing }) => (
    <View style={styles.gridItem}>
      <ListingCard listing={item} variant="grid" />
    </View>
  );

  const renderListHeader = () => (
    <View style={styles.resultRow}>
      <Text style={styles.resultCount}>
        <Text style={styles.resultCountNum}>{filtered.length}</Text>
        {' '}annonce{filtered.length !== 1 ? 's' : ''}
      </Text>
      {locationLabel ? (
        <View style={styles.locationChip}>
          <Ionicons name="location-outline" size={11} color={Colors.primary} />
          <Text style={styles.locationChipText}>{locationLabel}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View
        style={[styles.topBar, isWide && styles.topBarWide, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}
      >
        <View style={isWide ? styles.topBarInner : styles.topBarInnerMobile}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{name}</Text>
          <View style={styles.backBtn} />
        </View>
      </Animated.View>

      <Animated.View
        style={[styles.filterBar, isWide && styles.filterBarWide, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}
      >
        <View style={isWide ? styles.filterBarInner : undefined}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Rechercher dans ${name}…`}
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-outline" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeFiltersCount > 0 && styles.filterChipActive]}
            onPress={() => { setFilters(appliedFilters); setShowPanel(true); }}
            activeOpacity={0.75}
          >
            <Ionicons name="filter-outline" size={13} color={activeFiltersCount > 0 ? Colors.white : Colors.primary} />
            <Text style={[styles.filterChipText, activeFiltersCount > 0 && styles.filterChipTextActive]}>
              Filtres
            </Text>
            {activeFiltersCount > 0 && (
              <Animated.View style={[styles.filterBadge, { transform: [{ scale: filterBadgeScale }] }]}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </Animated.View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              (appliedFilters.sortKey !== 'recent') && styles.chipActive,
            ]}
            onPress={() => { setFilters(appliedFilters); setShowPanel(true); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, appliedFilters.sortKey !== 'recent' && styles.chipTextActive]}>
              {SORT_LABEL[appliedFilters.sortKey]}
            </Text>
            <Ionicons name="chevron-down-outline" size={12} color={appliedFilters.sortKey !== 'recent' ? Colors.white : Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chip}
            onPress={() => { setFilters(appliedFilters); setShowPanel(true); }}
            activeOpacity={0.75}
          >
            <Ionicons name="navigate-outline" size={12} color={Colors.primary} />
            <Text style={styles.chipText}>{locationLabel || 'Zone'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              (appliedFilters.priceMin !== '' || appliedFilters.priceMax !== '') && styles.chipActive,
            ]}
            onPress={() => { setFilters(appliedFilters); setShowPanel(true); }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.chipText,
                (appliedFilters.priceMin !== '' || appliedFilters.priceMax !== '') && styles.chipTextActive,
              ]}
            >
              {appliedFilters.priceMin !== '' || appliedFilters.priceMax !== ''
                ? `${appliedFilters.priceMin || '0'} – ${appliedFilters.priceMax || '∞'} €`
                : 'Prix'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, appliedFilters.ownerType !== 'all' && styles.chipActive]}
            onPress={() => { setFilters(appliedFilters); setShowPanel(true); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, appliedFilters.ownerType !== 'all' && styles.chipTextActive]}>
              {appliedFilters.ownerType === 'all'
                ? 'Tous'
                : appliedFilters.ownerType === 'particulier'
                ? 'Particulier'
                : 'Professionnel'}
            </Text>
            <Ionicons name="chevron-down-outline" size={12} color={appliedFilters.ownerType !== 'all' ? Colors.white : Colors.primary} />
          </TouchableOpacity>

          {activeFiltersCount > 0 && (
            <TouchableOpacity
              style={styles.resetChip}
              onPress={() => { setFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-outline" size={12} color={Colors.error} />
              <Text style={styles.resetChipText}>Effacer</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        </View>
      </Animated.View>

      <Animated.View
        style={[styles.flex, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}
      >
        {loading ? (
          isWide ? (
            <ScrollView contentContainerStyle={styles.webScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.webGridWrapper}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numColumns}, 1fr)`, gap: 16 } as any}>
                  {Array.from({ length: numColumns * 3 }).map((_, i) => (
                    <div key={i}><SkeletonCard variant="grid" /></div>
                  ))}
                </div>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.skeletonGrid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.gridItem}>
                  <SkeletonCard variant="grid" />
                </View>
              ))}
            </View>
          )
        ) : filtered.length === 0 ? (
          <CategoryEmptyState categoryName={name ?? ''} />
        ) : isWide ? (
          <ScrollView contentContainerStyle={styles.webScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.webGridWrapper}>
              {renderListHeader()}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numColumns}, 1fr)`, gap: 16 } as any}>
                {filtered.map((item) => (
                  <div key={item.id}>
                    <ListingCard listing={item} variant="grid" />
                  </div>
                ))}
              </div>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={2}
            renderItem={renderItem}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      <FilterPanel
        visible={showPanel}
        filters={filters}
        onFiltersChange={setFilters}
        onClose={() => setShowPanel(false)}
        onApply={handleApply}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  topBarWide: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 1200,
  },
  topBarInnerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  filterBar: {
    backgroundColor: Colors.background,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  filterBarWide: {
    alignItems: 'center',
  },
  filterBarInner: {
    width: '100%',
    maxWidth: 1200,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.text,
    padding: 0,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.white,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  filterBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  filterBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: Colors.primary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.white,
  },
  resetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.errorLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  resetChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.error,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  resultCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  resultCountNum: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  locationChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.primary,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  columnWrapper: {
    gap: 12,
  },
  gridItem: {
    width: '47.5%',
  },
  webScrollContent: {
    alignItems: 'center',
    paddingBottom: 48,
  },
  webGridWrapper: {
    width: '100%',
    maxWidth: 1200,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
});
