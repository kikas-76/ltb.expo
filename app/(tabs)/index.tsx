import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import HomeHeader from '@/components/explore/HomeHeader';
import SearchBar from '@/components/explore/SearchBar';
import CategoryStrip from '@/components/explore/CategoryStrip';
import LocationBanner from '@/components/explore/LocationBanner';
import ListingCard from '@/components/explore/ListingCard';
import EmptyState from '@/components/explore/EmptyState';
import SkeletonCard from '@/components/explore/SkeletonCard';
import RecentlyViewedSection from '@/components/explore/RecentlyViewedSection';
import FavoritesSection from '@/components/explore/FavoritesSection';
import PopularSection from '@/components/explore/PopularSection';
import DealsSection from '@/components/explore/DealsSection';
import { useResponsive } from '@/hooks/useResponsive';

interface Category {
  id: string;
  name: string;
  value: string | null;
  icon_path: string | null;
}

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
    is_pro?: boolean;
  } | null;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { profile, session, loading: authLoading } = useAuth();
  const { incomingRequestCount } = useUnread();
  const { width } = useWindowDimensions();
  const { isDesktop, isTablet, isTabletOrDesktop, isMobile } = useResponsive();

  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [nearbyData, setNearbyData] = useState<Listing[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/login');
    }
  }, [session, authLoading]);

  const fetchData = useCallback(async () => {
    try {
      const lat = profile?.location_data?.lat ?? null;
      const lng = profile?.location_data?.lng ?? null;
      const hasLocation = lat !== null && lng !== null;

      const baseSelect =
        'id, name, price, photos_url, category_name, category_id, latitude, longitude, location_data, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)';

      const [catRes, listingsRes, nearbyRes] = await Promise.all([
        supabase.from('categories').select('id, name, value, icon_path').order('order'),
        supabase
          .from('listings')
          .select(baseSelect)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(19),
        hasLocation
          ? supabase.rpc('get_nearby_listings', {
              user_lat: lat,
              user_lng: lng,
              radius_km: 9999,
              lim: 19,
              offset_val: 0,
            })
          : Promise.resolve({ data: null }),
      ]);

      if (catRes.data) setCategories(catRes.data);

      const mapOwner = (l: any) => ({
        ...l,
        owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
      });

      const recentMapped: Listing[] = listingsRes.data
        ? (listingsRes.data as any[]).map(mapOwner)
        : [];
      setListings(recentMapped);

      // Nearby: RPC returns listings already sorted by distance ASC but
      // without owner. Hydrate owners via a follow-up SELECT keyed on the
      // returned ids, then re-order to preserve the distance ordering.
      if (nearbyRes && (nearbyRes as any).data) {
        const rows = (nearbyRes as any).data as any[];
        if (rows.length === 0) {
          setNearbyData([]);
        } else {
          const ids = rows.map((r) => r.id);
          const { data: ownerRows } = await supabase
            .from('listings')
            .select(
              'id, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)',
            )
            .in('id', ids);
          const ownerMap = new Map<string, any>();
          (ownerRows ?? []).forEach((o: any) => {
            const owner = Array.isArray(o.owner) ? o.owner[0] : o.owner;
            ownerMap.set(o.id, owner ?? null);
          });
          const ordered: Listing[] = rows.map((r) => ({
            ...r,
            owner: ownerMap.get(r.id) ?? null,
          }));
          setNearbyData(ordered);
        }
      } else {
        // No location → reuse the recent feed so the section is not empty
        setNearbyData(recentMapped);
      }
    } finally {
      setLoadingData(false);
    }
  }, [profile?.location_data?.lat, profile?.location_data?.lng]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const applyFilters = (items: Listing[]) =>
    items.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const DESKTOP_GRID_LIMIT = 18;
  const filteredListings = applyFilters(listings);
  const filteredNearby = applyFilters(nearbyData);
  const hasMoreListings = isDesktop && filteredNearby.length > DESKTOP_GRID_LIMIT;
  const nearbyListings = isDesktop
    ? filteredNearby.slice(0, DESKTOP_GRID_LIMIT)
    : filteredNearby.slice(0, 8);
  const recentListings = isDesktop
    ? filteredListings.slice(0, DESKTOP_GRID_LIMIT)
    : filteredListings.slice(0, 8);
  const address = profile?.location_data?.address ?? null;
  const userLat = profile?.location_data?.lat ?? null;
  const userLng = profile?.location_data?.lng ?? null;

  const hPad = isDesktop ? 48 : isTablet ? 32 : 16;
  const maxW = isDesktop ? 1200 : isTablet ? 900 : undefined;

  const gridCols = isDesktop ? 4 : isTablet ? 3 : 2;
  const gridGap = isDesktop ? 16 : isTablet ? 14 : 10;
  const gridPadding = isTabletOrDesktop ? 0 : 32;
  const contentWidth = isTabletOrDesktop
    ? Math.min(width - hPad * 2, isDesktop ? 1200 : 900) - gridPadding
    : width - 32;
  const gridItemWidth = Math.floor((contentWidth - gridGap * (gridCols - 1)) / gridCols);

  if (authLoading) {
    return <View style={styles.loadingScreen} />;
  }

  const innerStyle = isTabletOrDesktop
    ? { maxWidth: maxW, width: '100%' as const, alignSelf: 'center' as const }
    : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topBar, isTabletOrDesktop && { paddingHorizontal: hPad }]}>
        <View style={innerStyle}>
          <HomeHeader
            username={profile?.username ?? null}
            photoUrl={profile?.photo_url ?? null}
            notificationCount={incomingRequestCount}
          />
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onPress={() => router.push('/search')}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTabletOrDesktop && { paddingHorizontal: hPad },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={innerStyle}>
          <CategoryStrip categories={categories} />
          <LocationBanner address={address} />

          <RecentlyViewedSection userLat={userLat} userLng={userLng} userId={session?.user.id} />
          <FavoritesSection userId={session?.user.id} userLat={userLat} userLng={userLng} />
          <PopularSection userLat={userLat} userLng={userLng} userId={session?.user.id} />
          <DealsSection userLat={userLat} userLng={userLng} userId={session?.user.id} />

          <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader} activeOpacity={0.7} onPress={() => router.push('/nearby')}>
              <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
                Objets près de chez vous
              </Text>
              <Ionicons name="chevron-forward-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>

            {loadingData ? (
              isDesktop && Platform.OS === 'web' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: gridGap, paddingLeft: 16, paddingRight: 16 } as any}>
                  {[1, 2, 3, 4].map((i) => <div key={i}><SkeletonCard variant="grid" /></div>)}
                </div>
              ) : (
                <View style={[styles.grid, { gap: gridGap }]}>
                  {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={[styles.gridItem, { width: gridItemWidth }]}>
                      <SkeletonCard variant="grid" />
                    </View>
                  ))}
                </View>
              )
            ) : nearbyListings.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {isDesktop && Platform.OS === 'web' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: gridGap, paddingLeft: 16, paddingRight: 16 } as any}>
                    {nearbyListings.map((item) => (
                      <div key={item.id}>
                        <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={session?.user.id} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <View style={[styles.grid, { gap: gridGap }]}>
                    {nearbyListings.map((item) => (
                      <View key={item.id} style={[styles.gridItem, { width: gridItemWidth }]}>
                        <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={session?.user.id} />
                      </View>
                    ))}
                  </View>
                )}
                {hasMoreListings && (
                  <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/nearby')}>
                    <Text style={styles.viewAllText}>Voir toutes les annonces</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <View style={[styles.section, styles.sectionLast]}>
            <TouchableOpacity style={styles.sectionHeader} activeOpacity={0.7} onPress={() => router.push('/recent')}>
              <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
                Annonces récentes
              </Text>
              <Ionicons name="chevron-forward-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>

            {loadingData ? (
              isDesktop && Platform.OS === 'web' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: gridGap, paddingLeft: 16, paddingRight: 16 } as any}>
                  {[1, 2, 3, 4].map((i) => <div key={i}><SkeletonCard variant="grid" /></div>)}
                </div>
              ) : (
                <View style={[styles.grid, { gap: gridGap }]}>
                  {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={[styles.gridItem, { width: gridItemWidth }]}>
                      <SkeletonCard variant="grid" />
                    </View>
                  ))}
                </View>
              )
            ) : recentListings.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {isDesktop && Platform.OS === 'web' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: gridGap, paddingLeft: 16, paddingRight: 16 } as any}>
                    {recentListings.map((item) => (
                      <div key={item.id}>
                        <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={session?.user.id} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <View style={[styles.grid, { gap: gridGap }]}>
                    {recentListings.map((item) => (
                      <View key={item.id} style={[styles.gridItem, { width: gridItemWidth }]}>
                        <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={session?.user.id} />
                      </View>
                    ))}
                  </View>
                )}
                {hasMoreListings && (
                  <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/recent')}>
                    <Text style={styles.viewAllText}>Voir toutes les annonces</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    backgroundColor: Colors.background,
    ...Platform.select({
      web: { position: 'sticky' as any, top: 0, zIndex: 10 },
    }),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 28,
  },
  sectionLast: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
  },
  sectionTitleMobile: {
    fontSize: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  gridItem: {
    flexGrow: 0,
    flexShrink: 0,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  viewAllText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.primary,
  },
});
