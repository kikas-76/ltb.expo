import { useEffect, useState, useCallback, useRef } from 'react';
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
import { readCache, writeCache } from '@/lib/queryCache';
import LoadError from '@/components/LoadError';
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
import HomeIntro from '@/components/HomeIntro';
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
  approx_latitude: number | null;
  approx_longitude: number | null;
  owner: {
    id?: string;
    username: string | null;
    photo_url: string | null;
    is_pro?: boolean;
  } | null;
}

interface PopularListing extends Listing {
  view_count: number;
}

/** Réponse de get_home_feed (un seul aller-retour serveur pour tout l'accueil). */
interface HomeFeed {
  categories: Category[];
  recent: Listing[];
  nearby: any[] | null;
  popular: (Listing & { views_count?: number | null })[];
  deals: Listing[];
  favorites: Listing[];
}

interface HomeCache {
  categories: Category[];
  listings: Listing[];
  nearby: Listing[];
  popular: PopularListing[];
  deals: Listing[];
  favorites: Listing[];
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
  const [popular, setPopular] = useState<PopularListing[]>([]);
  const [deals, setDeals] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Intro animée : uniquement quand aucune donnée n'est en cache (premier lancement).
  const [introVisible, setIntroVisible] = useState(true);
  const introStartedAt = useRef(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/login');
    }
  }, [session, authLoading]);

  // Affichage immédiat depuis le cache local, puis rafraîchissement réseau.
  const gotFreshHome = useRef(false);
  useEffect(() => {
    readCache<HomeCache>('home:v2').then((cached) => {
      if (!cached || gotFreshHome.current) return;
      setIntroVisible(false);
      setCategories(cached.categories);
      setListings(cached.listings);
      setNearbyData(cached.nearby);
      setPopular(cached.popular ?? []);
      setDeals(cached.deals ?? []);
      setFavorites(cached.favorites ?? []);
      setLoadingData(false);
    });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const lat = profile?.location_data?.lat ?? null;
      const lng = profile?.location_data?.lng ?? null;
      const hasLocation = lat !== null && lng !== null;

      // Un seul aller-retour serveur pour tout l'accueil (catégories, récentes,
      // à proximité, populaires, bonnes affaires, favoris). Auparavant sept
      // requêtes parallèles se disputaient le processeur partagé de l'instance.
      const { data: feedData, error: feedError } = await supabase.rpc('get_home_feed', {
        p_lat: lat,
        p_lng: lng,
        p_limit: 19,
      });
      if (feedError) {
        console.error('get_home_feed failed:', feedError);
        setLoadError(true);
        return;
      }
      setLoadError(false);
      const feed = (feedData ?? {}) as HomeFeed;
      const catRes = { data: feed.categories ?? [] };
      const listingsRes = { data: feed.recent ?? [] };
      const nearbyRes = { data: hasLocation ? feed.nearby ?? null : null };
      const popularMapped: PopularListing[] = (feed.popular ?? []).map((l) => ({ ...l, view_count: l.views_count ?? 0 }));
      const dealsList: Listing[] = feed.deals ?? [];
      const favoritesList: Listing[] = feed.favorites ?? [];
      setPopular(popularMapped);
      setDeals(dealsList);
      setFavorites(favoritesList);

      if (catRes.data) setCategories(catRes.data);

      type Owner = NonNullable<Listing['owner']>;
      type RawListing = Omit<Listing, 'owner'> & {
        owner: Owner | Owner[] | null;
      };
      const mapOwner = (l: RawListing): Listing => ({
        ...l,
        owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
      });

      const recentMapped: Listing[] = listingsRes.data
        ? (listingsRes.data as unknown as RawListing[]).map(mapOwner)
        : [];
      setListings(recentMapped);

      // Nearby: the RPC now returns owner info + rating in one shot
      // (extended in 20260506_extend_get_nearby_listings_*). No
      // follow-up SELECT needed — saves one round-trip per home load.
      type NearbyRow = {
        id: string;
        name: string;
        price: number;
        photos_url: string[] | null;
        category_name: string | null;
        category_id: string | null;
        approx_latitude: number | null;
        approx_longitude: number | null;
        owner_type: string | null;
        rating_avg: number | null;
        rating_count: number | null;
        owner_id: string | null;
        owner_username: string | null;
        owner_photo_url: string | null;
        owner_is_pro: boolean | null;
        distance_km: number | null;
      };
      const nearbyData = nearbyRes?.data as NearbyRow[] | null | undefined;
      let nearbyForCache: Listing[] = [];
      if (nearbyData) {
        const ordered: Listing[] = nearbyData.map((r) => ({
          id: r.id,
          name: r.name,
          price: r.price,
          photos_url: r.photos_url,
          category_name: r.category_name,
          category_id: r.category_id,
          approx_latitude: r.approx_latitude,
          approx_longitude: r.approx_longitude,
          rating_avg: r.rating_avg,
          rating_count: r.rating_count,
          owner: r.owner_id
            ? {
                id: r.owner_id,
                username: r.owner_username,
                photo_url: r.owner_photo_url,
                is_pro: r.owner_is_pro ?? false,
              }
            : null,
        }));
        setNearbyData(ordered);
        nearbyForCache = ordered;
      } else {
        // No location → reuse the recent feed so the section is not empty
        setNearbyData(recentMapped);
        nearbyForCache = recentMapped;
      }
      gotFreshHome.current = true;
      const toCache: HomeCache = {
        categories: catRes.data ?? [],
        listings: recentMapped,
        nearby: nearbyForCache,
        popular: popularMapped,
        deals: dealsList,
        favorites: favoritesList,
      };
      writeCache('home:v2', toCache);
    } finally {
      setLoadingData(false);
    }
  }, [profile?.location_data?.lat, profile?.location_data?.lng]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (loadingData) return;
    // Laisser l'intro finir sa phrase avant de la fondre (mini 1,6 s).
    const remaining = Math.max(0, 1600 - (Date.now() - introStartedAt.current));
    const t = setTimeout(() => setIntroVisible(false), remaining);
    return () => clearTimeout(t);
  }, [loadingData]);

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
      <HomeIntro visible={introVisible} />
      {/* Le bonjour défile avec le contenu ; la barre de recherche reste collée en haut
          (stickyHeaderIndices) : aucun saut de mise en page, tout est géré nativement. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTabletOrDesktop && { paddingHorizontal: hPad },
        ]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
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
          <HomeHeader
            username={profile?.username ?? null}
            photoUrl={profile?.photo_url ?? null}
            notificationCount={incomingRequestCount}
          />
        </View>
        <View style={[styles.stickyBar, innerStyle]}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onPress={() => router.push('/search')}
            prominent
          />
        </View>
        <View style={innerStyle}>
          <CategoryStrip categories={categories} />
          <LocationBanner address={address} />
          {loadError && (
            <LoadError
              compact
              onRetry={() => {
                setLoadError(false);
                setLoadingData(true);
                fetchData();
              }}
            />
          )}

          <RecentlyViewedSection userLat={userLat} userLng={userLng} userId={session?.user.id} />
          <FavoritesSection userId={session?.user.id} userLat={userLat} userLng={userLng} listings={favorites} loading={loadingData} />
          <PopularSection userLat={userLat} userLng={userLng} userId={session?.user.id} listings={popular} loading={loadingData} />
          <DealsSection userLat={userLat} userLng={userLng} userId={session?.user.id} listings={deals} loading={loadingData} />

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
  stickyBar: {
    backgroundColor: Colors.background,
    paddingBottom: 4,
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
