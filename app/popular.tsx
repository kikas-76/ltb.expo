import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ListingCard from '@/components/explore/ListingCard';
import SkeletonCard from '@/components/explore/SkeletonCard';
import FilterPanel from '@/components/explore/FilterPanel';
import { CITIES } from '@/components/explore/FilterPanel';
import { useResponsive } from '@/hooks/useResponsive';
import { usePageFilters } from '@/hooks/usePageFilters';

interface Listing {
  id: string;
  name: string;
  price: number;
  photos_url: string[] | null;
  category_name: string | null;
  category_id: string | null;
  latitude: number | null;
  longitude: number | null;
  views_count: number;
  saves_count: number;
  score: number;
  owner_type: string | null;
  owner: {
    id?: string;
    username: string | null;
    photo_url: string | null;
  } | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

const SORT_OPTIONS = [
  { label: 'Score global', value: 'score' },
  { label: 'Vues', value: 'views' },
  { label: 'Favoris', value: 'favorites' },
];

const PAGE_SIZE = 20;

export default function PopularPage() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const { isDesktop, isTablet } = useResponsive();
  const pageFilters = usePageFilters();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState<'score' | 'views' | 'favorites'>('score');
  const [page, setPage] = useState(0);

  const userLat = profile?.location_data?.lat ?? null;
  const userLng = profile?.location_data?.lng ?? null;
  const userId = session?.user.id ?? null;
  const numColumns = isDesktop ? 4 : isTablet ? 3 : 2;

  const { filters, selectedCategoryIds } = pageFilters;

  const fetchListings = useCallback(
    async (pageNum: number, sort: typeof sortBy, reset = false) => {
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);

      const orderCol = sort === 'views' ? 'views_count' : sort === 'favorites' ? 'saves_count' : 'views_count';

      let query = supabase
        .from('listings')
        .select(
          'id, name, price, photos_url, category_name, category_id, latitude, longitude, location_data, owner_type, views_count, saves_count, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)'
        )
        .eq('is_active', true)
        .order(orderCol, { ascending: false });

      if (filters.ownerType !== 'all') query = query.eq('owner_type', filters.ownerType);
      if (filters.priceMin !== '') query = query.gte('price', Number(filters.priceMin));
      if (filters.priceMax !== '') query = query.lte('price', Number(filters.priceMax));
      if (selectedCategoryIds.length > 0) query = query.in('category_id', selectedCategoryIds);

      if (filters.locationMode !== 'none') {
        let refLat: number | null = null;
        let refLng: number | null = null;
        if (filters.locationMode === 'around_me') { refLat = userLat; refLng = userLng; }
        else if (filters.locationMode === 'city') {
          const city = CITIES.find((c) => c.value === filters.selectedCity);
          if (city) { refLat = city.lat; refLng = city.lng; }
        }
        if (refLat !== null && refLng !== null) {
          query = query
            .not('latitude', 'is', null)
            .not('longitude', 'is', null);
        }
      }

      query = query.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      const { data } = await query;

      if (data && data.length > 0) {
        let filtered = data as any[];

        if (filters.locationMode !== 'none') {
          let refLat: number | null = null;
          let refLng: number | null = null;
          if (filters.locationMode === 'around_me') { refLat = userLat; refLng = userLng; }
          else if (filters.locationMode === 'city') {
            const city = CITIES.find((c) => c.value === filters.selectedCity);
            if (city) { refLat = city.lat; refLng = city.lng; }
          }
          if (refLat !== null && refLng !== null) {
            filtered = filtered.filter(
              (l) => l.latitude != null && l.longitude != null &&
                haversineKm(refLat!, refLng!, l.latitude, l.longitude) <= filters.radiusKm
            );
          }
        }

        const mapped: Listing[] = filtered.map((l: any) => ({
          ...l,
          owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
          views_count: l.views_count ?? 0,
          saves_count: l.saves_count ?? 0,
          score: (l.views_count ?? 0) + (l.saves_count ?? 0) * 3,
        }));

        const sorted = sort === 'score'
          ? [...mapped].sort((a, b) => b.score - a.score)
          : mapped;

        setListings((prev) => (reset || pageNum === 0 ? sorted : [...prev, ...sorted]));
        setHasMore(data.length === PAGE_SIZE);
      } else if (reset || pageNum === 0) {
        setListings([]);
        setHasMore(false);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [filters, selectedCategoryIds, userLat, userLng]
  );

  useEffect(() => {
    setPage(0);
    fetchListings(0, sortBy, true);
  }, [sortBy, filters, selectedCategoryIds]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchListings(next, sortBy);
  };

  const activeCount = pageFilters.activeFilterCount;

  const PageHeader = (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      <View style={isDesktop ? styles.headerInner : styles.headerInnerMobile}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="trending-up-outline" size={18} color={Colors.primaryDark} />
          <Text style={styles.headerTitle}>Les plus populaires</Text>
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeCount > 0 && styles.filterBtnActive]}
          onPress={pageFilters.openPanel}
          activeOpacity={0.75}
        >
          <Ionicons name="options-outline" size={16} color={activeCount > 0 ? Colors.white : Colors.text} />
          {activeCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const SortBar = (
    <View style={[styles.sortBar, isDesktop && styles.sortBarDesktop]}>
      <View style={isDesktop ? styles.sortBarInner : styles.sortBarInnerMobile}>
        <Text style={styles.sortLabel}>Classé par :</Text>
        <View style={styles.sortOptions}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.sortChip, sortBy === opt.value && styles.sortChipActive]}
              onPress={() => setSortBy(opt.value as typeof sortBy)}
              activeOpacity={0.75}
            >
              <Text style={[styles.sortChipText, sortBy === opt.value && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const WebGrid = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.webScrollContent}
      showsVerticalScrollIndicator={false}
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) loadMore();
      }}
      scrollEventThrottle={400}
    >
      <View style={styles.webGridWrapper}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numColumns}, 1fr)`, gap: 16 } as any}>
          {loading
            ? Array.from({ length: numColumns * 3 }).map((_, i) => <div key={i}><SkeletonCard variant="grid" /></div>)
            : listings.map((item, index) => (
                <div key={item.id} style={{ position: 'relative' } as any}>
                  {index < 3 && (
                    <View style={[styles.rankBadge, index === 0 && styles.rankBadgeGold, index === 1 && styles.rankBadgeSilver, index === 2 && styles.rankBadgeBronze]}>
                      <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                    </View>
                  )}
                  <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={userId} />
                </div>
              ))}
        </div>
        {loadingMore && <View style={styles.loadMoreIndicator}><ActivityIndicator size="small" color={Colors.primary} /></View>}
        {!loading && listings.length === 0 && <EmptyState />}
      </View>
    </ScrollView>
  );

  const MobileList = loading ? (
    <View style={styles.grid}>
      {[1, 2, 3, 4].map((i) => <View key={i} style={styles.gridItem}><SkeletonCard variant="grid" /></View>)}
    </View>
  ) : (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={styles.listContent}
      columnWrapperStyle={styles.columnWrapper}
      showsVerticalScrollIndicator={false}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      renderItem={({ item, index }) => (
        <View style={styles.gridItem}>
          <View style={styles.rankBadgeWrap}>
            {index < 3 && (
              <View style={[styles.rankBadge, index === 0 && styles.rankBadgeGold, index === 1 && styles.rankBadgeSilver, index === 2 && styles.rankBadgeBronze]}>
                <Text style={styles.rankBadgeText}>#{index + 1}</Text>
              </View>
            )}
            <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={userId} />
          </View>
        </View>
      )}
      ListFooterComponent={loadingMore ? <View style={styles.loadMoreIndicator}><ActivityIndicator size="small" color={Colors.primary} /></View> : null}
      ListEmptyComponent={<EmptyState />}
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      {PageHeader}
      {SortBar}
      {Platform.OS === 'web' && (isDesktop || isTablet) ? WebGrid : MobileList}
      <FilterPanel
        visible={pageFilters.filterPanelVisible}
        filters={pageFilters.pendingFilters}
        onFiltersChange={pageFilters.setPendingFilters}
        onClose={pageFilters.closePanel}
        onApply={pageFilters.applyPanel}
        categories={pageFilters.categories}
        selectedCategoryIds={pageFilters.pendingCategoryIds}
        onToggleCategory={pageFilters.toggleCategory}
      />
    </SafeAreaView>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="trending-up-outline" size={40} color={Colors.border} />
      <Text style={styles.emptyTitle}>Aucune annonce populaire</Text>
      <Text style={styles.emptySubtitle}>Aucun résultat pour ces filtres</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  headerDesktop: { paddingHorizontal: 24, justifyContent: 'center' },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', maxWidth: 1200,
  },
  headerInnerMobile: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.text, letterSpacing: -0.3 },
  filterBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.notification, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontFamily: 'Inter-Bold', fontSize: 9, color: Colors.white },
  sortBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight, flexWrap: 'wrap',
  },
  sortBarDesktop: { justifyContent: 'center', paddingHorizontal: 24 },
  sortBarInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '100%', maxWidth: 1200, flexWrap: 'wrap',
  },
  sortBarInnerMobile: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  sortLabel: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textMuted },
  sortOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sortChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  sortChipText: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.textSecondary },
  sortChipTextActive: { color: '#fff' },
  webScrollContent: { alignItems: 'center', paddingBottom: 48 },
  webGridWrapper: { width: '100%', maxWidth: 1200, paddingHorizontal: 24, paddingTop: 24 },
  listContent: { paddingHorizontal: 12, paddingBottom: 32, paddingTop: 4 },
  columnWrapper: { gap: 10, marginBottom: 10 },
  gridItem: { flex: 1 },
  rankBadgeWrap: { position: 'relative' },
  rankBadge: {
    position: 'absolute', top: 6, left: 6, zIndex: 10,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.border,
  },
  rankBadgeGold: { backgroundColor: '#F5C842' },
  rankBadgeSilver: { backgroundColor: '#C0C0C0' },
  rankBadgeBronze: { backgroundColor: '#CD7F32' },
  rankBadgeText: { fontFamily: 'Inter-Bold', fontSize: 9, color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 4, gap: 10 },
  loadMoreIndicator: { paddingVertical: 20, alignItems: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: Colors.text },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
