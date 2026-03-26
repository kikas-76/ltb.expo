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
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  MapPin,
  Navigation,
} from 'lucide-react-native';
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

interface Listing {
  id: string;
  name: string;
  price: number;
  photos_url: string[] | null;
  category_name: string | null;
  category_id: string | null;
  latitude: number | null;
  longitude: number | null;
  owner_type: string | null;
  owner: {
    username: string | null;
    photo_url: string | null;
  } | null;
}

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SORT_LABEL: Record<SortKey, string> = {
  recent: 'Plus récentes',
  nearest: 'Plus proches',
  price_asc: 'Prix croissant',
  price_desc: 'Prix décroissant',
};

export default function CategoryScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

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
          'id, name, price, photos_url, category_name, category_id, latitude, longitude, owner_type, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro)'
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
        if (!l.latitude || !l.longitude) return true;
        return haversineKm(ref.lat, ref.lng, l.latitude, l.longitude) <= 30;
      });
    }

    if (appliedFilters.sortKey === 'price_asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (appliedFilters.sortKey === 'price_desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (appliedFilters.sortKey === 'nearest' && ref) {
      result.sort((a, b) => {
        const dA =
          a.latitude && a.longitude
            ? haversineKm(ref.lat, ref.lng, a.latitude, a.longitude)
            : 9999;
        const dB =
          b.latitude && b.longitude
            ? haversineKm(ref.lat, ref.lng, b.latitude, b.longitude)
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
          <MapPin size={11} color={Colors.primary} strokeWidth={2} />
          <Text style={styles.locationChipText}>{locationLabel}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View
        style={[styles.topBar, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <View style={styles.backBtn} />
      </Animated.View>

      <Animated.View
        style={[styles.filterBar, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}
      >
        <View style={styles.searchBox}>
          <Search size={15} color={Colors.textMuted} strokeWidth={2} />
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
              <X size={14} color={Colors.textMuted} strokeWidth={2} />
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
            <SlidersHorizontal
              size={13}
              color={activeFiltersCount > 0 ? Colors.white : Colors.primary}
              strokeWidth={2}
            />
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
            <ChevronDown size={12} color={appliedFilters.sortKey !== 'recent' ? Colors.white : Colors.primary} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chip}
            onPress={() => { setFilters(appliedFilters); setShowPanel(true); }}
            activeOpacity={0.75}
          >
            <Navigation size={12} color={Colors.primary} strokeWidth={2} />
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
            <ChevronDown size={12} color={appliedFilters.ownerType !== 'all' ? Colors.white : Colors.primary} strokeWidth={2} />
          </TouchableOpacity>

          {activeFiltersCount > 0 && (
            <TouchableOpacity
              style={styles.resetChip}
              onPress={() => { setFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); }}
              activeOpacity={0.7}
            >
              <X size={12} color={Colors.error} strokeWidth={2.5} />
              <Text style={styles.resetChipText}>Effacer</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>

      <Animated.View
        style={[styles.flex, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}
      >
        {loading ? (
          <View style={styles.skeletonGrid}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.gridItem}>
                <SkeletonCard variant="grid" />
              </View>
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <CategoryEmptyState categoryName={name ?? ''} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: Colors.background,
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
});
