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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
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
  const { width } = useWindowDimensions();
  const { isDesktop, isTablet, isTabletOrDesktop } = useResponsive();

  const cardWidth = isDesktop
    ? Math.min(width * 0.18, 240)
    : isTablet
    ? Math.min(width * 0.28, 220)
    : Math.min(Math.max(width * 0.42, 148), 200);

  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/login');
    }
  }, [session, authLoading]);

  const fetchData = useCallback(async () => {
    try {
      const [catRes, listingsRes] = await Promise.all([
        supabase.from('categories').select('id, name, value, icon_path').order('order'),
        supabase
          .from('listings')
          .select(
            'id, name, price, photos_url, category_name, category_id, latitude, longitude, location_data, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)'
          )
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (catRes.data) setCategories(catRes.data);

      if (listingsRes.data) {
        const mapped: Listing[] = listingsRes.data.map((l: any) => ({
          ...l,
          owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
        }));
        setListings(mapped);
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

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

  const nearbyListings = applyFilters(listings.slice(0, isDesktop ? 9 : 6));
  const recentListings = applyFilters(listings.slice(0, isDesktop ? 9 : 6));
  const address = profile?.location_data?.address ?? null;
  const userLat = profile?.location_data?.lat ?? null;
  const userLng = profile?.location_data?.lng ?? null;

  const maxW = isDesktop ? 1200 : isTablet ? 768 : undefined;
  const hPad = isDesktop ? 48 : isTablet ? 32 : 0;

  const gridCols = isDesktop ? 4 : isTablet ? 3 : 2;
  const gridGap = isDesktop ? 16 : isTablet ? 16 : 12;
  const gridPad = isDesktop ? 0 : isTablet ? 0 : 16;
  const availableWidth = isTabletOrDesktop
    ? Math.min(width - hPad * 2, isDesktop ? 1200 : 768)
    : width - gridPad * 2;
  const gridItemWidth = Math.floor((availableWidth - gridGap * (gridCols - 1)) / gridCols);

  if (authLoading) {
    return <View style={styles.loadingScreen} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topBar, isTabletOrDesktop && { paddingHorizontal: hPad }]}>
        <View style={isTabletOrDesktop ? { maxWidth: maxW, width: '100%', alignSelf: 'center' } : undefined}>
          <HomeHeader
            username={profile?.username ?? null}
            photoUrl={profile?.photo_url ?? null}
            notificationCount={0}
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
        <View style={isTabletOrDesktop ? { maxWidth: maxW, width: '100%', alignSelf: 'center' } : undefined}>
          <CategoryStrip categories={categories} />
          <LocationBanner address={address} />

          <RecentlyViewedSection userLat={userLat} userLng={userLng} userId={session?.user.id} />
          <FavoritesSection userId={session?.user.id} userLat={userLat} userLng={userLng} />
          <PopularSection userLat={userLat} userLng={userLng} userId={session?.user.id} />
          <DealsSection userLat={userLat} userLng={userLng} userId={session?.user.id} />

          <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader} activeOpacity={0.7} onPress={() => router.push('/nearby')}>
              <Text style={styles.sectionTitle}>Objets près de chez vous</Text>
              <Ionicons name="chevron-forward-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>

            {loadingData ? (
              isTabletOrDesktop ? (
                <View style={[styles.grid, { gap: gridGap, paddingHorizontal: gridPad }]}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={[styles.gridItem, { width: gridItemWidth }]}>
                      <SkeletonCard variant="grid" />
                    </View>
                  ))}
                </View>
              ) : (
                <FlatList
                  horizontal
                  data={[1, 2, 3]}
                  keyExtractor={(i) => String(i)}
                  renderItem={() => (
                    <View style={styles.horizontalCardWrapper}>
                      <SkeletonCard variant="horizontal" />
                    </View>
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  scrollEnabled={false}
                />
              )
            ) : nearbyListings.length === 0 ? (
              <EmptyState />
            ) : isTabletOrDesktop ? (
              <View style={[styles.grid, { gap: gridGap, paddingHorizontal: gridPad }]}>
                {nearbyListings.map((item) => (
                  <View key={item.id} style={[styles.gridItem, { width: gridItemWidth }]}>
                    <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={session?.user.id} />
                  </View>
                ))}
              </View>
            ) : (
              <FlatList
                horizontal
                data={nearbyListings}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={{ width: cardWidth }}>
                    <ListingCard listing={item} variant="horizontal" userLat={userLat} userLng={userLng} userId={session?.user.id} />
                  </View>
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              />
            )}
          </View>

          <View style={[styles.section, styles.sectionLast]}>
            <TouchableOpacity style={styles.sectionHeader} activeOpacity={0.7} onPress={() => router.push('/recent')}>
              <Text style={styles.sectionTitle}>Annonces récentes</Text>
              <Ionicons name="chevron-forward-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>

            {loadingData ? (
              <View style={[styles.grid, { gap: gridGap, paddingHorizontal: gridPad }]}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={[styles.gridItem, { width: gridItemWidth }]}>
                    <SkeletonCard variant="grid" />
                  </View>
                ))}
              </View>
            ) : recentListings.length === 0 ? (
              <EmptyState />
            ) : (
              <View style={[styles.grid, { gap: gridGap, paddingHorizontal: gridPad }]}>
                {recentListings.map((item) => (
                  <View key={item.id} style={[styles.gridItem, { width: gridItemWidth }]}>
                    <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={session?.user.id} />
                  </View>
                ))}
              </View>
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginTop: 24,
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
  horizontalCardWrapper: {},
  horizontalList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  gridItem: {
    flexGrow: 0,
    flexShrink: 0,
  },
});
