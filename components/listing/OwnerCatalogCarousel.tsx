import { memo, useEffect, useState } from 'react';
import { View, Text, FlatList, Platform, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import ListingCard from '@/components/explore/ListingCard';
import SkeletonCard from '@/components/explore/SkeletonCard';

interface Listing {
  id: string;
  name: string;
  price: number;
  photos_url: string[] | null;
  category_name: string | null;
  category_id: string | null;
  approx_latitude: number | null;
  approx_longitude: number | null;
  rating_avg: number | null;
  rating_count: number | null;
  owner: {
    id: string;
    username: string | null;
    photo_url: string | null;
    is_pro: boolean;
  } | null;
}

interface Props {
  ownerId: string;
  ownerUsername: string | null;
  excludeId: string;
  // Optional date filter — when set, the carousel hides listings that are
  // saturated for the given window so the renter only sees actionable
  // suggestions. Same dates also forwarded as ?start/?end on the next href.
  startDate?: string | null;
  endDate?: string | null;
  userLat?: number | null;
  userLng?: number | null;
  userId?: string | null;
}

function OwnerCatalogCarousel({
  ownerId,
  ownerUsername,
  excludeId,
  startDate,
  endDate,
  userLat,
  userLng,
  userId,
}: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isDesktop = width >= 1024;
  const cardWidth = isMobile ? Math.round(width * 0.7) : isDesktop ? 240 : 220;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_owner_other_active_listings', {
        p_owner_id: ownerId,
        p_exclude_id: excludeId,
        p_start_date: startDate ?? null,
        p_end_date: endDate ?? null,
        p_limit: 12,
      });
      if (cancelled) return;
      if (data) {
        const mapped: Listing[] = (data as any[]).map((r) => ({
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
        setListings(mapped);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ownerId, excludeId, startDate, endDate]);

  // The owner card is itself a link to /owner/[id]; if there are no other
  // listings to show, just render nothing (the owner card stays).
  if (!loading && listings.length === 0) return null;

  // When tapping a card, forward the chosen dates so the next listing
  // detail can pre-fill the calendar (component listing/[id].tsx reads
  // useLocalSearchParams.start/end).
  const wrapHref = (id: string) => {
    if (Platform.OS !== 'web') {
      // expo-router supports both shapes; on native we navigate via push
      return null;
    }
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    const qs = params.toString();
    return `/listing/${id}${qs ? `?${qs}` : ''}`;
  };

  const onCardPress = (id: string) => {
    if (Platform.OS === 'web') {
      const href = wrapHref(id);
      if (href) router.push(href as any);
    } else {
      router.push({ pathname: '/listing/[id]', params: { id, start: startDate ?? '', end: endDate ?? '' } } as any);
    }
  };

  const skeletons = [1, 2, 3];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="storefront-outline" size={16} color={Colors.primaryDark} />
          <Text style={styles.title}>
            Plus d'objets de @{ownerUsername ?? 'ce pro'}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            const params = new URLSearchParams();
            if (startDate) params.set('start', startDate);
            if (endDate) params.set('end', endDate);
            const qs = params.toString();
            router.push(`/owner/${ownerId}${qs ? `?${qs}` : ''}` as any);
          }}
          style={styles.allBtn}
        >
          <Text style={styles.allBtnText}>Tout voir</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <FlatList
          horizontal
          data={skeletons}
          keyExtractor={(i) => String(i)}
          renderItem={() => (
            <View style={[styles.cardWrapper, { width: cardWidth }]}>
              <SkeletonCard variant="grid" />
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
            <TouchableOpacity
              style={[styles.cardWrapper, { width: cardWidth }]}
              activeOpacity={0.85}
              onPress={() => onCardPress(item.id)}
            >
              <ListingCard
                listing={item}
                variant={isMobile ? 'horizontal' : 'grid'}
                userLat={userLat}
                userLng={userLng}
                userId={userId}
              />
            </TouchableOpacity>
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
  section: { marginTop: 20, marginBottom: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.text,
    flexShrink: 1,
  },
  allBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  listContent: { paddingHorizontal: 20, gap: 12 },
  cardWrapper: {},
});

export default memo(OwnerCatalogCarousel);
