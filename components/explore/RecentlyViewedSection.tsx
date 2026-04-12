import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import ListingCard from './ListingCard';
import SkeletonCard from './SkeletonCard';

const STORAGE_KEY = 'ltb_recently_viewed';

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
  userLat?: number | null;
  userLng?: number | null;
  userId?: string | null;
}

function getRecentIds(): string[] {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }
  } catch {}
  return [];
}

export default function RecentlyViewedSection({ userLat, userLng, userId }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [ids, setIds] = useState<string[]>([]);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  useEffect(() => {
    const recent = getRecentIds();
    setIds(recent);
  }, []);

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from('listings')
        .select(
          'id, name, price, photos_url, category_name, category_id, latitude, longitude, location_data, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)'
        )
        .in('id', ids)
        .eq('is_active', true);

      if (data) {
        const mapped: Listing[] = data.map((l: any) => ({
          ...l,
          owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
        }));
        const ordered = ids
          .map((id) => mapped.find((l) => l.id === id))
          .filter(Boolean)
          .filter((l) => !userId || l!.owner?.id !== userId)
          .slice(0, 10) as Listing[];
        setListings(ordered);
      }
      setLoading(false);
    };

    fetch();
  }, [ids]);

  if (!loading && listings.length === 0) return null;

  const skeletons = [1, 2, 3];

  if (isDesktop) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Récemment consultés</Text>
        </View>
        {Platform.OS === 'web' ? (
          <div className="hide-scrollbar" style={{ overflowX: 'auto', paddingLeft: 16, paddingRight: 16, paddingBottom: 8 } as any}>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 16, width: 'max-content' } as any}>
              {loading
                ? skeletons.map((i) => (
                    <div key={i} style={{ width: 260, flexShrink: 0 } as any}>
                      <SkeletonCard variant="grid" />
                    </div>
                  ))
                : listings.map((item) => (
                    <div key={item.id} style={{ width: 260, flexShrink: 0 } as any}>
                      <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={userId} />
                    </div>
                  ))}
            </div>
          </div>
        ) : (
          <FlatList
            horizontal
            data={loading ? skeletons as any[] : listings}
            keyExtractor={(item: any) => String(item.id ?? item)}
            renderItem={({ item }: any) =>
              loading ? (
                <View style={[styles.cardWrapper, { width: 240 }]}>
                  <SkeletonCard variant="grid" />
                </View>
              ) : (
                <View style={[styles.cardWrapper, { width: 240 }]}>
                  <ListingCard listing={item} variant="grid" userLat={userLat} userLng={userLng} userId={userId} />
                </View>
              )
            }
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    );
  }

  if (isTablet) {
    const cols = 2;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Récemment consultés</Text>
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
        <Text style={styles.sectionTitle}>Récemment consultés</Text>
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
