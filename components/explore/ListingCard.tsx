import { memo, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useFavorite } from '@/hooks/useFavorite';
import ProBadge from '@/components/ProBadge';
import { getOptimizedImageUrl } from '@/lib/imageUrl';

function extractCityFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',');
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2].trim();
    const match = cityPart.match(/^\d{4,6}\s+(.+)$/);
    if (match) return match[1].trim();
    return cityPart;
  }
  return null;
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
  location_data?: { address?: string; city?: string } | null;
  owner: {
    id?: string;
    username: string | null;
    photo_url: string | null;
    is_pro?: boolean;
    location_data?: { address?: string; city?: string } | null;
  } | null;
}

interface ListingCardProps {
  listing: Listing;
  variant?: 'horizontal' | 'grid';
  userLat?: number | null;
  userLng?: number | null;
  userId?: string | null;
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
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function FavoriteButton({ listingId, userId, listingName }: { listingId: string; userId: string; listingName: string }) {
  const { isFavorite, toggle } = useFavorite(listingId, userId, listingName);

  return (
    <TouchableOpacity
      style={styles.heartBtn}
      onPress={(e) => {
        e.stopPropagation?.();
        toggle();
      }}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={14}
        color={isFavorite ? Colors.notification : 'rgba(255,255,255,0.95)'}
      />
    </TouchableOpacity>
  );
}

function ListingCard({ listing, variant = 'grid', userLat, userLng, userId }: ListingCardProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const cardWidth = isMobile
    ? Math.round(width * 0.7)
    : width < 1024
    ? Math.min(width * 0.28, 220)
    : Math.min(width * 0.18, 260);

  const photo = listing.photos_url?.[0];
  const ownerInitials = listing.owner?.username
    ? listing.owner.username.slice(0, 2).toUpperCase()
    : '?';

  const distanceText = useMemo(() => {
    if (userLat == null || userLng == null || listing.latitude == null || listing.longitude == null) return null;
    return formatDistance(haversineKm(userLat, userLng, listing.latitude, listing.longitude));
  }, [userLat, userLng, listing.latitude, listing.longitude]);

  const cityText =
    listing.location_data?.city ||
    extractCityFromAddress(listing.location_data?.address) ||
    listing.owner?.location_data?.city ||
    extractCityFromAddress(listing.owner?.location_data?.address) ||
    null;

  const isOwnListing = userId && listing.owner?.id && userId === listing.owner.id;
  const canFavorite = userId && !isOwnListing;

  return (
    <TouchableOpacity
      style={[styles.card, variant === 'horizontal' && { width: cardWidth }]}
      onPress={() => router.push(`/listing/${listing.id}` as any)}
      activeOpacity={0.88}
    >
      <View style={styles.imageContainer}>
        {photo ? (
          Platform.OS === 'web' ? (
            <img
              src={getOptimizedImageUrl(photo, { width: 800, quality: 80 }) ?? photo}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', backgroundColor: '#F5F2E3' }}
            />
          ) : (
            <Image source={{ uri: getOptimizedImageUrl(photo, { width: 800, quality: 80 }) ?? photo }} style={styles.image} resizeMode="contain" />
          )
        ) : (
          <View style={styles.imageFallback} />
        )}
        {distanceText && (
          <View style={styles.distanceBadge}>
            <Ionicons name="location-outline" size={9} color={Colors.primaryDark} />
            <Text style={styles.distanceText}>{distanceText}</Text>
          </View>
        )}
        {canFavorite && (
          <FavoriteButton listingId={listing.id} userId={userId!} listingName={listing.name} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{listing.name}</Text>
        <Text style={styles.price}>
          {listing.price}€ <Text style={styles.priceUnit}>/ jour</Text>
        </Text>

        {cityText && (
          <View style={styles.cityBadge}>
            <Ionicons name="location-outline" size={9} color={Colors.primaryDark} />
            <Text style={styles.cityBadgeText} numberOfLines={1}>{cityText}</Text>
          </View>
        )}

        <View style={styles.footer}>
          {listing.owner?.photo_url ? (
            <Image source={{ uri: getOptimizedImageUrl(listing.owner.photo_url, { width: 96, height: 96, resize: 'cover' }) ?? listing.owner.photo_url }} style={styles.ownerAvatar} />
          ) : (
            <View style={styles.ownerAvatarFallback}>
              <Text style={styles.ownerAvatarText}>{ownerInitials}</Text>
            </View>
          )}
          <Text style={styles.ownerName} numberOfLines={1}>
            {listing.owner?.username ? `@${listing.owner.username}` : 'Utilisateur'}
          </Text>
          {listing.owner?.is_pro && <ProBadge size="sm" />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
    }),
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F5F2E3',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primaryLight,
  },
  distanceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  distanceText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: Colors.primaryDark,
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 10,
    gap: 3,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  cityBadgeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: Colors.textMuted,
    flex: 1,
  },
  name: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  price: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.primaryDark,
  },
  priceUnit: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  ownerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  ownerAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerAvatarText: {
    fontFamily: 'Inter-Bold',
    fontSize: 8,
    color: Colors.primaryDark,
  },
  ownerName: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
});

export default memo(ListingCard);
