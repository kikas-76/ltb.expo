import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoritesContext } from '@/contexts/FavoritesContext';
import { Colors } from '@/constants/colors';
import ListingCard from '@/components/explore/ListingCard';
import { SkeletonGrid } from '@/components/Skeleton';
import { PRELAUNCH_MODE } from '@/lib/launchConfig';
import PreviewUnavailable from '@/components/PreviewUnavailable';

interface FavoriteListing {
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
  } | null;
}

export default function FavoritesScreen() {
  if (PRELAUNCH_MODE) {
    return (
      <PreviewUnavailable
        title="Favoris pas encore disponibles"
        description="La page Favoris s'ouvrira avec la marketplace. En attendant, continue à déposer tes annonces."
      />
    );
  }
  return <FavoritesScreenContent />;
}

function FavoritesScreenContent() {
  const { user, profile } = useAuth();
  const { refreshKey } = useFavoritesContext();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1024 ? 4 : width >= 640 ? 3 : 2;

  const [listings, setListings] = useState<FavoriteListing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async (showLoader = false) => {
    if (!user) return;
    if (showLoader) setLoading(true);

    const { data, error } = await supabase
      .from('saved_listings')
      .select(`
        saved_at,
        listing_id,
        listings!saved_listings_listing_id_fkey(
          id,
          name,
          price,
          photos_url,
          category_name,
          category_id,
          approx_latitude,
          approx_longitude,
          profiles!listings_owner_id_fkey(id, username, photo_url)
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Favorites fetch error:', error);
    }

    if (data) {
      type SavedListingRow = {
        saved_at: string;
        listings:
          | (Omit<FavoriteListing, 'owner'> & {
              profiles: FavoriteListing['owner'] | FavoriteListing['owner'][] | null;
            })
          | (Omit<FavoriteListing, 'owner'> & {
              profiles: FavoriteListing['owner'] | FavoriteListing['owner'][] | null;
            })[]
          | null;
      };
      const sorted = [...(data as SavedListingRow[])].sort((a, b) =>
        new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
      );
      const mapped: FavoriteListing[] = sorted
        .map((row) => {
          const l = Array.isArray(row.listings) ? row.listings[0] : row.listings;
          if (!l) return null;
          const owner = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
          return {
            id: l.id,
            name: l.name,
            price: l.price,
            photos_url: l.photos_url,
            category_name: l.category_name,
            category_id: l.category_id,
            approx_latitude: l.approx_latitude,
            approx_longitude: l.approx_longitude,
            owner: owner ?? null,
          };
        })
        .filter((x): x is FavoriteListing => x !== null);
      setListings(mapped);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFavorites(refreshKey === 0);
  }, [fetchFavorites, refreshKey]);

  const userLat = profile?.location_data?.lat ?? null;
  const userLng = profile?.location_data?.lng ?? null;

  const renderItem = ({ item }: { item: FavoriteListing }) => (
    <View style={styles.cardWrapper}>
      <ListingCard
        listing={item}
        variant="grid"
        userLat={userLat}
        userLng={userLng}
        userId={user?.id}
      />
    </View>
  );

  const firstPhoto = listings.find(l => l.photos_url?.[0])?.photos_url?.[0];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes favoris</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <SkeletonGrid count={6} />
      ) : listings.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIllustration}>
            <LinearGradient
              colors={[Colors.primaryLight + '60', Colors.primary + '30']}
              style={styles.emptyGradientCircle}
            >
              <View style={styles.emptyInnerCircle}>
                <Ionicons name="heart-outline" size={36} color={Colors.primaryDark} />
              </View>
            </LinearGradient>
            <View style={styles.emptyDotTL} />
            <View style={styles.emptyDotBR} />
          </View>
          <Text style={styles.emptyTitle}>Aucun favori pour l'instant</Text>
          <Text style={styles.emptySub}>
            Appuyez sur le <Text style={styles.emptyAccent}>coeur</Text> sur une annonce pour l'ajouter à vos favoris.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => router.push('/(tabs)/' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles-outline" size={15} color={Colors.white} />
            <Text style={styles.exploreBtnText}>Explorer les annonces</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 32 },
            width >= 1024 && styles.listDesktop,
          ]}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.listHeaderRow}>
                <View style={styles.countBadge}>
                  <Ionicons name="heart" size={12} color={Colors.primaryDark} />
                  <Text style={styles.countBadgeText}>
                    {listings.length} favori{listings.length > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
    }),
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  listDesktop: {
    paddingHorizontal: 40,
    paddingTop: 16,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  cardWrapper: {
    flex: 1,
  },
  listHeader: {
    paddingTop: 16,
    paddingBottom: 4,
    marginBottom: 4,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight + '70',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary + '60',
  },
  countBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
    letterSpacing: -0.1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    gap: 16,
  },
  emptyIllustration: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  emptyGradientCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInnerCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(142,152,120,0.18)' },
    }),
  },
  emptyDotTL: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary + '80',
  },
  emptyDotBR: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primaryLight,
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyAccent: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
  },
  exploreBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryDark,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 5 },
      web: { boxShadow: '0 4px 14px rgba(142,152,120,0.4)' },
    }),
  },
  exploreBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.white,
    letterSpacing: 0.1,
  },
});
