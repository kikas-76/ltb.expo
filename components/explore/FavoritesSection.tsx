import { memo, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import ListingCard from './ListingCard';
import SkeletonCard from './SkeletonCard';
import { useFavoritesContext } from '@/contexts/FavoritesContext';

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

interface Props {
  userId: string | null | undefined;
  userLat?: number | null;
  userLng?: number | null;
}

function FavoritesSection({ userId, userLat, userLng }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshKey } = useFavoritesContext();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from('saved_listings')
        .select(
          `listing:listings!saved_listings_listing_id_fkey(
            id, name, price, photos_url, category_name, category_id, latitude, longitude, location_data,
            owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)
          )`
        )
        .eq('user_id', userId)
        .eq('listing.is_active', true)
        .order('saved_at', { ascending: false })
        .limit(4);

      if (data) {
        const mapped: Listing[] = data
          .map((row: any) => {
            const l = Array.isArray(row.listing) ? row.listing[0] : row.listing;
            if (!l) return null;
            return {
              ...l,
              owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
            };
          })
          .filter(Boolean) as Listing[];
        setListings(mapped);
      }
      setLoading(false);
    };

    fetch();
  }, [userId, refreshKey]);

  if (!loading && listings.length === 0) return null;

  const skeletons = [1, 2, 3];

  if (isDesktop || isTablet) {
    const cols = isDesktop ? 4 : 2;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes coups de cœur</Text>
          <Ionicons name="heart" size={17} color="#E05252" />
        </View>
        <View style={[styles.gridContainer, { paddingHorizontal: 20 }]}>
          {loading
            ? skeletons.map((i) => (
                <View key={i} style={[styles.gridCell, { width: `${100 / cols - 1}%` }]}>
                  <SkeletonCard variant="grid" />
                </View>
              ))
            : listings.map((item) => (
                <View key={item.id} style={[styles.gridCell, { width: `${100 / cols - 1}%` }]}>
                  <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={userId} />
                </View>
              ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mes coups de cœur</Text>
        <Ionicons name="heart" size={17} color="#E05252" />
      </View>

      {loading ? (
        <FlatList
          horizontal
          data={skeletons}
          keyExtractor={(i) => String(i)}
          renderItem={() => (
            <View style={styles.cardWrapper}>
              <SkeletonCard variant="horizontal" />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          scrollEnabled={false}
        />
      ) : (
        <FlatList
          horizontal
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ListingCard listing={item} variant="horizontal" userLat={userLat} userLng={userLng} userId={userId} />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          snapToInterval={Math.round(width * 0.7) + 12}
          decelerationRate="fast"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  cardWrapper: {
    width: 180,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridCell: {
    minWidth: 0,
  },
});

export default memo(FavoritesSection);
