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
  approx_latitude: number | null;
  approx_longitude: number | null;
  owner_type: string | null;
  owner: {
    id?: string;
    username: string | null;
    photo_url: string | null;
  } | null;
}

import { haversineKm } from '@/lib/distance';

const SORT_OPTIONS = [
  { label: 'Prix croissant', value: 'asc' },
  { label: 'Prix décroissant', value: 'desc' },
];

const PAGE_SIZE = 20;

export default function DealsPage() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const { isDesktop, isTablet } = useResponsive();
  const pageFilters = usePageFilters();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const userLat = profile?.location_data?.lat ?? null;
  const userLng = profile?.location_data?.lng ?? null;
  const userId = session?.user.id ?? null;
  const numColumns = isDesktop ? 4 : isTablet ? 3 : 2;

  const { filters, selectedCategoryIds } = pageFilters;

  const fetchListings = useCallback(
    async (pageNum: number, order: 'asc' | 'desc', reset = false) => {
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);

      let query = supabase
        .from('listings')
        .select(
          'id, name, price, photos_url, category_name, category_id, approx_latitude, approx_longitude, owner_type, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro)'
        )
        .eq('is_active', true)
        .order('price', { ascending: order === 'asc' });

      if (filters.ownerType !== 'all') query = query.eq('owner_type', filters.ownerType);
      if (filters.priceMin !== '') query = query.gte('price', Number(filters.priceMin));
      if (filters.priceMax !== '') query = query.lte('price', Number(filters.priceMax));
      if (selectedCategoryIds.length > 0) query = query.in('category_id', selectedCategoryIds);

      const fetchSize = filters.locationMode !== 'none' ? PAGE_SIZE * 5 : PAGE_SIZE;
      query = query.range(pageNum * fetchSize, (pageNum + 1) * fetchSize - 1);

      const { data } = await query;

      if (data) {
        type Row = Listing & { owner: Listing['owner'] | Listing['owner'][] };
        let mapped: Listing[] = (data as unknown as Row[]).map((l) => ({
          ...l,
          owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
        }));

        if (filters.locationMode !== 'none') {
          let refLat: number | null = null;
          let refLng: number | null = null;
          if (filters.locationMode === 'around_me') { refLat = userLat; refLng = userLng; }
          else if (filters.locationMode === 'city') {
            const city = CITIES.find((c) => c.value === filters.selectedCity);
            if (city) { refLat = city.lat; refLng = city.lng; }
          }
          if (refLat !== null && refLng !== null) {
            mapped = mapped
              .filter((l) => l.approx_latitude != null && l.approx_longitude != null)
              .filter((l) => haversineKm(refLat!, refLng!, l.approx_latitude!, l.approx_longitude!) <= filters.radiusKm)
              .slice(0, PAGE_SIZE);
          }
        } else {
          mapped = mapped.slice(0, PAGE_SIZE);
        }

        setListings((prev) => (reset || pageNum === 0 ? mapped : [...prev, ...mapped]));
        setHasMore(mapped.length === PAGE_SIZE && filters.locationMode === 'none');
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [filters, selectedCategoryIds, userLat, userLng]
  );

  useEffect(() => {
    setPage(0);
    fetchListings(0, sortOrder, true);
  }, [sortOrder, filters, selectedCategoryIds]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchListings(next, sortOrder);
  };

  const activeCount = pageFilters.activeFilterCount;
  const minPrice = listings.length > 0 ? Math.min(...listings.map((l) => l.price)) : null;
  const maxPrice = listings.length > 0 ? Math.max(...listings.map((l) => l.price)) : null;

  const PageHeader = (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      <View style={isDesktop ? styles.headerInner : styles.headerInnerMobile}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="pricetag-outline" size={18} color={Colors.primaryDark} />
          <Text style={styles.headerTitle}>Bonnes affaires</Text>
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

  const ToolBar = (
    <View style={[styles.toolbar, isDesktop && styles.toolbarDesktop]}>
      <View style={isDesktop ? styles.toolbarInner : styles.toolbarInnerMobile}>
        <View style={styles.sortRow}>
          <Ionicons name="filter-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.sortLabel}>Prix :</Text>
          <View style={styles.sortOptions}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sortChip, sortOrder === opt.value && styles.sortChipActive]}
                onPress={() => setSortOrder(opt.value as 'asc' | 'desc')}
                activeOpacity={0.75}
              >
                <Text style={[styles.sortChipText, sortOrder === opt.value && styles.sortChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {!loading && listings.length > 0 && minPrice !== null && maxPrice !== null && (
          <Text style={styles.statsRange}>{minPrice}€ – {maxPrice}€ / jour</Text>
        )}
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
            : listings.map((item) => (
                <div key={item.id}>
                  <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={userId} />
                </div>
              ))}
        </div>
        {loadingMore && <View style={styles.loadMoreIndicator}><ActivityIndicator size="small" color={Colors.primary} /></View>}
        {!loading && listings.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={40} color={Colors.border} />
            <Text style={styles.emptyTitle}>Aucune annonce</Text>
            <Text style={styles.emptySubtitle}>Aucun résultat pour ces filtres</Text>
          </View>
        )}
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
      renderItem={({ item }) => (
        <View style={styles.gridItem}>
          <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={userId} />
        </View>
      )}
      ListFooterComponent={loadingMore ? <View style={styles.loadMoreIndicator}><ActivityIndicator size="small" color={Colors.primary} /></View> : null}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="pricetag-outline" size={40} color={Colors.border} />
          <Text style={styles.emptyTitle}>Aucune annonce</Text>
          <Text style={styles.emptySubtitle}>Aucun résultat pour ces filtres</Text>
        </View>
      }
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      {PageHeader}
      {ToolBar}
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
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  toolbarDesktop: { justifyContent: 'center', paddingHorizontal: 24 },
  toolbarInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', maxWidth: 1200,
  },
  toolbarInnerMobile: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sortLabel: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textMuted },
  sortOptions: { flexDirection: 'row', gap: 8 },
  sortChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  sortChipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  sortChipText: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.textSecondary },
  sortChipTextActive: { color: '#fff' },
  statsRange: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.textMuted },
  webScrollContent: { alignItems: 'center', paddingBottom: 48 },
  webGridWrapper: { width: '100%', maxWidth: 1200, paddingHorizontal: 24, paddingTop: 24 },
  listContent: { paddingHorizontal: 12, paddingBottom: 32, paddingTop: 4 },
  columnWrapper: { gap: 10, marginBottom: 10 },
  gridItem: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 4, gap: 10 },
  loadMoreIndicator: { paddingVertical: 20, alignItems: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: Colors.text },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});
