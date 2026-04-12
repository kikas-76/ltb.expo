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
import { useResponsive } from '@/hooks/useResponsive';

interface Listing {
  id: string;
  name: string;
  price: number;
  photos_url: string[] | null;
  category_name: string | null;
  category_id: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
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

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `à ${km.toFixed(1)} km`;
}

const PAGE_SIZE = 20;

export default function NearbyPage() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const { isDesktop, isTablet } = useResponsive();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [allSorted, setAllSorted] = useState<Listing[]>([]);

  const userLat = profile?.location_data?.lat ?? null;
  const userLng = profile?.location_data?.lng ?? null;
  const userId = session?.user.id ?? null;
  const hasLocation = userLat !== null && userLng !== null;

  const numColumns = isDesktop ? 4 : isTablet ? 3 : 2;

  const fetchAndSort = useCallback(async () => {
    if (!hasLocation) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data } = await supabase
      .from('listings')
      .select(
        'id, name, price, photos_url, category_name, category_id, latitude, longitude, location_data, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)'
      )
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(500);

    if (data) {
      const mapped: Listing[] = data
        .map((l: any) => {
          const dist =
            l.latitude != null && l.longitude != null
              ? haversineKm(userLat!, userLng!, l.latitude, l.longitude)
              : null;
          return {
            ...l,
            owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
            distanceKm: dist,
          };
        })
        .sort((a, b) => {
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        });

      setAllSorted(mapped);
      setListings(mapped.slice(0, PAGE_SIZE));
      setHasMore(mapped.length > PAGE_SIZE);
    }

    setLoading(false);
  }, [userLat, userLng, hasLocation]);

  useEffect(() => {
    fetchAndSort();
  }, [fetchAndSort]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    const nextBatch = allSorted.slice(0, (next + 1) * PAGE_SIZE);
    setListings(nextBatch);
    setHasMore(allSorted.length > (next + 1) * PAGE_SIZE);
    setPage(next);
    setLoadingMore(false);
  };

  const PageHeader = (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      <View style={isDesktop ? styles.headerInner : { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="location-outline" size={18} color={Colors.primaryDark} />
          <Text style={styles.headerTitle}>Près de chez vous</Text>
        </View>
        <View style={styles.headerRight} />
      </View>
    </View>
  );

  if (!hasLocation && !loading) {
    return (
      <SafeAreaView style={styles.safe}>
        {PageHeader}
        <View style={styles.noLocationState}>
          <View style={styles.noLocationIcon}>
            <Ionicons name="location-outline" size={36} color={Colors.textMuted} />
          </View>
          <Text style={styles.noLocationTitle}>Localisation manquante</Text>
          <Text style={styles.noLocationSubtitle}>
            Ajoute ton adresse pour voir les objets autour de toi
          </Text>
          <TouchableOpacity
            style={styles.addAddressBtn}
            onPress={() => router.push('/edit-address')}
            activeOpacity={0.8}
          >
            <Text style={styles.addAddressBtnText}>Ajouter mon adresse</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (Platform.OS === 'web' && (isDesktop || isTablet)) {
    const skeletonCount = numColumns * 3;
    return (
      <SafeAreaView style={styles.safe}>
        {PageHeader}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.webScrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          <View style={styles.webGridWrapper}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numColumns}, 1fr)`, gap: 16 } as any}>
              {loading
                ? Array.from({ length: skeletonCount }).map((_, i) => (
                    <div key={i}>
                      <SkeletonCard variant="grid" />
                    </div>
                  ))
                : listings.map((item) => (
                    <div key={item.id}>
                      <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={userId} />
                      {item.distanceKm !== null && (
                        <View style={styles.distanceBadge}>
                          <Ionicons name="location-outline" size={10} color={Colors.primary} />
                          <Text style={styles.distanceText}>{formatDistance(item.distanceKm)}</Text>
                        </View>
                      )}
                    </div>
                  ))}
            </div>
            {loadingMore && (
              <View style={styles.loadMoreIndicator}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            )}
            {!loading && listings.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={40} color={Colors.border} />
                <Text style={styles.emptyTitle}>Aucune annonce à proximité</Text>
                <Text style={styles.emptySubtitle}>Il n'y a pas encore d'objets près de chez vous</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {PageHeader}

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
              <View>
                <ListingCard
                  listing={item}
                  variant="grid"
                  userLat={userLat}
                  userLng={userLng}
                  userId={userId}
                />
                {item.distanceKm !== null && (
                  <View style={styles.distanceBadge}>
                    <Ionicons name="location-outline" size={10} color={Colors.primary} />
                    <Text style={styles.distanceText}>{formatDistance(item.distanceKm)}</Text>
                  </View>
                )}
              </View>
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
              <Ionicons name="location-outline" size={40} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucune annonce à proximité</Text>
              <Text style={styles.emptySubtitle}>Il n'y a pas encore d'objets près de chez vous</Text>
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
  headerDesktop: {
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 1200,
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
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
    paddingTop: 8,
  },
  columnWrapper: {
    gap: 10,
    marginBottom: 10,
  },
  gridItem: {
    flex: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 2,
  },
  distanceText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 8,
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
    paddingHorizontal: 32,
  },
  noLocationState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  noLocationIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noLocationTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
  },
  noLocationSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  addAddressBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addAddressBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
});
