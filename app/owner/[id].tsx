import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import ProBadge from '@/components/ProBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

type DayHours = { open: string; close: string; closed: boolean };
type WeekHours = Record<string, DayHours>;

const DAYS_FR: Record<string, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mer',
  thursday: 'Jeu',
  friday: 'Ven',
  saturday: 'Sam',
  sunday: 'Dim',
};

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface OwnerProfile {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  photo_url: string | null;
  location_data: any;
  created_at: string;
  is_pro: boolean;
  business_address: string | null;
  business_hours: WeekHours | null;
  business_type: string | null;
  business_name: string | null;
}

interface Listing {
  id: string;
  name: string | null;
  price: number;
  photos_url: string[] | null;
  category_name: string | null;
}

function formatMemberSince(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function parseCity(address: string | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2];
    const match = cityPart.match(/^\d{4,6}\s+(.+)$/);
    if (match) return match[1].trim();
    return cityPart;
  }
  return parts[0] ?? null;
}

function ListingMiniCard({ listing }: { listing: Listing }) {
  const photo = listing.photos_url?.[0];
  return (
    <TouchableOpacity
      style={styles.listingCard}
      activeOpacity={0.82}
      onPress={() => router.push(`/listing/${listing.id}` as any)}
    >
      <View style={styles.listingImageWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.listingImage} resizeMode="cover" />
        ) : (
          <View style={styles.listingImageFallback}>
            <Ionicons name="cube-outline" size={26} color={Colors.primary} />
          </View>
        )}
        <View style={styles.priceTag}>
          <Text style={styles.priceTagText}>{listing.price}€</Text>
          <Text style={styles.priceTagUnit}>/j</Text>
        </View>
      </View>
      <View style={styles.listingBody}>
        <Text style={styles.listingName} numberOfLines={2}>
          {listing.name || 'Sans nom'}
        </Text>
        {listing.category_name && (
          <Text style={styles.listingCategory} numberOfLines={1}>
            {listing.category_name}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function OwnerProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [profileRes, listingsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, bio, avatar_url, photo_url, location_data, created_at, is_pro, business_address, business_hours, business_type, business_name')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('listings')
          .select('id, name, price, photos_url, category_name')
          .eq('owner_id', id)
          .order('created_at', { ascending: false }),
      ]);
      if (profileRes.data) setOwner(profileRes.data);
      if (listingsRes.data) setListings(listingsRes.data);
      setLoading(false);
    })();
  }, [id]);

  const photo = owner?.avatar_url ?? owner?.photo_url;
  const name = owner?.username ? `@${owner.username}` : 'Utilisateur';
  const initials = name.slice(0, 2).toUpperCase();
  const city =
    owner?.location_data?.city ??
    parseCity(owner?.location_data?.address) ??
    null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {loading ? (
          <View style={[styles.loadingWrap, { paddingTop: insets.top + 80 }]}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <>
            <View style={[styles.heroSection, { paddingTop: insets.top + 16 }]}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back-outline" size={18} color={Colors.text} />
              </TouchableOpacity>

              <View style={styles.avatarContainer}>
                <View style={styles.avatarRing}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.onlineDot} />
              </View>

              <View style={styles.heroNameRow}>
                <Text style={styles.heroName}>{name}</Text>
                {owner?.is_pro && <ProBadge />}
              </View>

              <View style={styles.metaChipsRow}>
                {owner?.created_at && (
                  <View style={styles.metaChip}>
                    <Ionicons name="time-outline" size={12} color={Colors.primaryDark} />
                    <Text style={styles.metaChipText}>
                      Membre depuis {formatMemberSince(owner.created_at)}
                    </Text>
                  </View>
                )}
                {city && (
                  <View style={styles.metaChip}>
                    <Ionicons name="location-outline" size={12} color={Colors.primaryDark} />
                    <Text style={styles.metaChipText}>{city}</Text>
                  </View>
                )}
              </View>

              {owner?.bio ? (
                <View style={styles.bioCard}>
                  <Text style={styles.bioText}>{owner.bio}</Text>
                </View>
              ) : (
                <View style={styles.emptyBioCard}>
                  <Text style={styles.emptyBioText}>
                    Ce membre n'a pas encore rempli son profil
                  </Text>
                </View>
              )}

              {owner?.is_pro && (owner.business_type || owner.business_address || owner.business_hours) && (
                <View style={styles.proInfoCard}>
                  {owner.business_name ? (
                    <View style={styles.proInfoRow}>
                      <Ionicons name="storefront-outline" size={14} color={Colors.primaryDark} />
                      <Text style={styles.proInfoLabel}>{owner.business_name}</Text>
                    </View>
                  ) : null}
                  {owner.business_type ? (
                    <View style={styles.proInfoRow}>
                      <Ionicons name="briefcase-outline" size={14} color={Colors.primaryDark} />
                      <Text style={styles.proInfoText}>{owner.business_type}</Text>
                    </View>
                  ) : null}
                  {owner.business_address ? (
                    <View style={styles.proInfoRow}>
                      <Ionicons name="location-outline" size={14} color={Colors.primaryDark} />
                      <Text style={styles.proInfoText} numberOfLines={2}>{owner.business_address}</Text>
                    </View>
                  ) : null}
                  {owner.business_hours && (
                    <View style={styles.proHoursSection}>
                      <View style={styles.proInfoRow}>
                        <Ionicons name="time-outline" size={14} color={Colors.primaryDark} />
                        <Text style={styles.proInfoLabel}>Horaires</Text>
                      </View>
                      <View style={styles.hoursGrid}>
                        {DAYS_ORDER.map((dayKey) => {
                          const dayHours = owner.business_hours![dayKey];
                          if (!dayHours) return null;
                          return (
                            <View key={dayKey} style={styles.hoursRow}>
                              <Text style={styles.hoursDay}>{DAYS_FR[dayKey]}</Text>
                              {dayHours.closed ? (
                                <Text style={styles.hoursClosed}>Fermé</Text>
                              ) : (
                                <Text style={styles.hoursTime}>{dayHours.open} – {dayHours.close}</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.statsBand}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{listings.length}</Text>
                  <Text style={styles.statLabel}>Annonce{listings.length !== 1 ? 's' : ''}</Text>
                </View>
              </View>
            </View>

            <View style={styles.listingsSection}>
              <View style={styles.listingsHeader}>
                <Ionicons name="grid-outline" size={18} color={Colors.text} />
                <Text style={styles.listingsSectionTitle}>Ses Annonces</Text>
              </View>

              {listings.length === 0 ? (
                <View style={styles.noListingsWrap}>
                  <View style={styles.noListingsIcon}>
                    <Ionicons name="cube-outline" size={32} color={Colors.primary} />
                  </View>
                  <Text style={styles.noListingsTitle}>Aucune annonce</Text>
                  <Text style={styles.noListingsText}>
                    Ce membre n'a pas encore publié d'annonces
                  </Text>
                </View>
              ) : (
                <View style={styles.listingsGrid}>
                  {listings.map((item) => (
                    <ListingMiniCard key={item.id} listing={item} />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
  },
  loadingWrap: {
    alignItems: 'center',
  },
  heroSection: {
    backgroundColor: '#D8DDCA',
    paddingHorizontal: 24,
    paddingBottom: 0,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarContainer: {
    marginTop: 8,
    marginBottom: 16,
    position: 'relative',
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: Colors.white,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    backgroundColor: Colors.white,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Inter-Bold',
    fontSize: 36,
    color: Colors.white,
    letterSpacing: 1,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 2.5,
    borderColor: Colors.white,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  heroName: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  metaChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  bioCard: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 20,
    maxWidth: SCREEN_WIDTH - 64,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  bioText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyBioCard: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 20,
    maxWidth: SCREEN_WIDTH - 64,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  emptyBioText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  proInfoCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 10,
    maxWidth: SCREEN_WIDTH - 64,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  proInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proInfoLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  proInfoText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  proHoursSection: {
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(183,191,156,0.3)',
    marginTop: 2,
  },
  hoursGrid: {
    gap: 4,
    paddingLeft: 22,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoursDay: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
    width: 32,
  },
  hoursTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.text,
  },
  hoursClosed: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  statsBand: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: -20,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  listingsSection: {
    paddingTop: 36,
    paddingHorizontal: 20,
  },
  listingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  listingsSectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listingCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },
  listingImageWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  listingImageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceTagText: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: Colors.primaryDark,
  },
  priceTagUnit: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: Colors.textMuted,
  },
  listingBody: {
    padding: 10,
    gap: 3,
  },
  listingName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  listingCategory: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  noListingsWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  noListingsIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noListingsTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.text,
  },
  noListingsText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 220,
  },
});
