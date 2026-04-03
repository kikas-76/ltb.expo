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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ListingCard from '@/components/explore/ListingCard';
import SkeletonCard from '@/components/explore/SkeletonCard';

interface Listing {
  id: string;
  name: string;
  price: number;
  photos_url: string[] | null;
  category_name: string | null;
  category_id: string | null;
  latitude: number | null;
  longitude: number | null;
  owner: {
    id?: string;
    username: string | null;
    photo_url: string | null;
  } | null;
}

const SORT_OPTIONS = [
  { label: 'Prix croissant', value: 'asc' },
  { label: 'Prix décroissant', value: 'desc' },
];

const PAGE_SIZE = 20;

export default function DealsPage() {
  const router = useRouter();
  const { profile, session } = useAuth();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const userLat = profile?.location_data?.lat ?? null;
  const userLng = profile?.location_data?.lng ?? null;
  const userId = session?.user.id ?? null;

  const fetchListings = useCallback(async (pageNum: number, order: 'asc' | 'desc', reset = false) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    const { data } = await supabase
      .from('listings')
      .select(
        'id, name, price, photos_url, category_name, category_id, latitude, longitude, location_data, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)'
      )
      .eq('is_active', true)
      .order('price', { ascending: order === 'asc' })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (data) {
      const mapped: Listing[] = data.map((l: any) => ({
        ...l,
        owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
      }));
      setListings((prev) => (reset || pageNum === 0 ? mapped : [...prev, ...mapped]));
      setHasMore(data.length === PAGE_SIZE);
    }

    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    setPage(0);
    fetchListings(0, sortOrder, true);
  }, [sortOrder]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchListings(next, sortOrder);
  };

  const minPrice = listings.length > 0 ? Math.min(...listings.map((l) => l.price)) : null;
  const maxPrice = listings.length > 0 ? Math.max(...listings.map((l) => l.price)) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="pricetag-outline" size={18} color={Colors.primaryDark} />
          <Text style={styles.headerTitle}>Bonnes affaires</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.sortBar}>
        <View style={styles.sortLeft}>
          <Ionicons name="filter-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.sortLabel}>Trier par :</Text>
        </View>
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

      {!loading && listings.length > 0 && (
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            {listings.length}+ annonce{listings.length > 1 ? 's' : ''}
          </Text>
          {minPrice !== null && maxPrice !== null && (
            <Text style={styles.statsRange}>
              de {minPrice}€ à {maxPrice}€ / jour
            </Text>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.grid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={styles.gridItem}>
              <SkeletonCard variant="grid" />
            </View>
          ))}
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
              <ListingCard
                listing={item}
                variant="grid"
                userLat={userLat}
                userLng={userLng}
                userId={userId}
              />
            </View>
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreIndicator}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={40} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucune annonce</Text>
              <Text style={styles.emptySubtitle}>Revenez bientôt pour de nouvelles offres</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 38,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  sortChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sortChipTextActive: {
    color: '#fff',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statsText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  statsRange: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
    paddingTop: 4,
  },
  columnWrapper: {
    gap: 10,
    marginBottom: 10,
  },
  gridItem: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 10,
  },
  loadMoreIndicator: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.text,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
