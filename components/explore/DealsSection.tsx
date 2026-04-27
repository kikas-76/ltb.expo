import { memo, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import ListingCard from './ListingCard';
import SkeletonCard from './SkeletonCard';

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
  } | null;
}

interface Props {
  userLat?: number | null;
  userLng?: number | null;
  userId?: string | null;
}

function DealsSection({ userLat, userLng, userId }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const cardWidth = isMobile
    ? Math.round(width * 0.7)
    : isDesktop
    ? Math.min(width * 0.18, 260)
    : Math.min(width * 0.28, 220);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('listings')
        .select(
          'id, name, price, photos_url, category_name, category_id, approx_latitude, approx_longitude, owner:profiles!listings_owner_id_fkey(id, username, photo_url, is_pro, location_data)'
        )
        .eq('is_active', true)
        .order('price', { ascending: true })
        .limit(10);

      if (data) {
        type Owner = NonNullable<Listing['owner']>;
        type Row = Omit<Listing, 'owner'> & { owner: Owner | Owner[] | null };
        const mapped: Listing[] = (data as unknown as Row[]).map((l) => ({
          ...l,
          owner: Array.isArray(l.owner) ? (l.owner[0] ?? null) : l.owner,
        }));
        setListings(mapped);
      }
      setLoading(false);
    };

    fetch();
  }, []);

  if (!loading && listings.length === 0) return null;

  const skeletons = [1, 2, 3];

  const SectionHeader = () => (
    <TouchableOpacity
      style={styles.sectionHeader}
      activeOpacity={0.7}
      onPress={() => router.push('/deals' as any)}
    >
      <View style={styles.titleRow}>
        <Ionicons name="pricetag-outline" size={16} color={Colors.primaryDark} />
        <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>Bonnes affaires</Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={18} color={Colors.primary} />
    </TouchableOpacity>
  );

  if (isDesktop) {
    return (
      <View style={styles.section}>
        <SectionHeader />
        {Platform.OS === 'web' ? (
          <div style={{ overflowX: 'auto', paddingLeft: 16, paddingRight: 16, paddingBottom: 8, msOverflowStyle: 'none', scrollbarWidth: 'none' } as any}>
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
        <SectionHeader />
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
      <SectionHeader />

      {loading ? (
        <FlatList
          horizontal
          data={skeletons}
          keyExtractor={(i) => String(i)}
          renderItem={() => (
            <View style={[styles.cardWrapper, { width: cardWidth }]}>
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
            <View style={[styles.cardWrapper, { width: cardWidth }]}>
              <ListingCard
                listing={item}
                variant="horizontal"
                userLat={userLat}
                userLng={userLng}
                userId={userId}
              />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          snapToInterval={cardWidth + 12}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
  },
  sectionTitleMobile: {
    fontSize: 18,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  cardWrapper: {},
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridCell: {
    minWidth: 0,
  },
});

export default memo(DealsSection);
