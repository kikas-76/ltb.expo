import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  Share,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { postSystemMessage } from '@/lib/postSystemMessage';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { getCityFromCoords } from '@/lib/googleMaps';
import { useFavorite } from '@/hooks/useFavorite';
import { useFavoritesContext } from '@/contexts/FavoritesContext';
import ImageGallery from '@/components/listing/ImageGallery';
import DateRangeCalendar from '@/components/listing/DateRangeCalendar';
import RequestSentOverlay from '@/components/listing/RequestSentOverlay';
import RequestMessageModal from '@/components/listing/RequestMessageModal';
import ProBadge from '@/components/ProBadge';
import ApproximateLocationMap from '@/components/listing/ApproximateLocationMap';
import ShareLinkModal from '@/components/listing/ShareLinkModal';
import { Skeleton } from '@/components/Skeleton';
import { getOptimizedImageUrl } from '@/lib/imageUrl';

const RECENTLY_VIEWED_KEY = 'ltb_recently_viewed';
const MAX_RECENTLY_VIEWED = 5;

function trackRecentlyViewed(listingId: string) {
  if (Platform.OS !== 'web') return;
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const filtered = ids.filter((id) => id !== listingId);
    const updated = [listingId, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {}
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.42;
const SCROLL_THRESHOLD = HEADER_IMAGE_HEIGHT - 80;

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  electronique: { bg: '#E8F2FF', text: '#3A6BBF', border: '#B8D4FF' },
  bricolage:    { bg: '#E4F5E4', text: '#3A7A3A', border: '#B0DEB0' },
  sport:        { bg: '#FFF0E0', text: '#C06828', border: '#FFD0A0' },
  maison:       { bg: '#FBF3E0', text: '#9A6820', border: '#F0D898' },
  evenementiel: { bg: '#FFE8F5', text: '#C050A0', border: '#F5B8E0' },
  vetements:    { bg: '#FFE8E8', text: '#B84040', border: '#FFBCBC' },
  enfants:      { bg: '#F0E8FF', text: '#7040B8', border: '#D4BCFF' },
  autre:        { bg: '#EFEFEF', text: '#666666', border: '#D0D0D0' },
};

interface Listing {
  id: string;
  name: string;
  description: string | null;
  price: number;
  deposit_amount: number | null;
  photos_url: string[] | null;
  category_name: string | null;
  category_id: string | null;
  latitude: number | null;
  longitude: number | null;
  location_data: any;
  created_at: string;
  owner: {
    id: string;
    username: string | null;
    photo_url: string | null;
    avatar_url: string | null;
    location_data: any;
    created_at: string;
    is_pro: boolean;
    business_name: string | null;
    business_address: string | null;
    business_type: string | null;
    business_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
    siren_number: string | null;
  } | null;
  category: {
    value: string | null;
  } | null;
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

function formatMemberSince(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, session } = useAuth();
  const userId = session?.user.id ?? null;
  const { showSnackbar } = useFavoritesContext();
  const { isDesktop, isTabletOrDesktop } = useResponsive();
  const { width: windowWidth } = useWindowDimensions();

  const [listing, setListing] = useState<Listing | null>(null);
  const { isFavorite, toggle: toggleFavorite } = useFavorite(id ?? '', userId, listing?.name ?? undefined);
  const initialFavoriteRef = useRef<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteBlockedError, setDeleteBlockedError] = useState(false);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null);
  const [selectedDays, setSelectedDays] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [existingConvId, setExistingConvId] = useState<string | null>(null);
  const [bookedRanges, setBookedRanges] = useState<{ start: Date; end: Date }[]>([]);
  const [cityName, setCityName] = useState<string | null>(null);
  const [shareLinkVisible, setShareLinkVisible] = useState(false);
  const [firstPhotoAspect, setFirstPhotoAspect] = useState<number>(4 / 3);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (id) fetchListing();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`saved_listings:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_listings',
          filter: `listing_id=eq.${id}`,
        },
        async () => {
          const { count } = await supabase
            .from('saved_listings')
            .select('*', { count: 'exact', head: true })
            .eq('listing_id', id);
          setLikeCount(count ?? 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Measure the first photo so the gallery height adapts to its aspect ratio
  // (avoids huge empty bands around portrait phone uploads). Must run on
  // every render (no early-return between hooks), so it sits next to its
  // siblings; guards on the listing existing.
  useEffect(() => {
    const firstPhoto = listing?.photos_url?.[0];
    if (!firstPhoto) return;
    Image.getSize(
      firstPhoto,
      (w, h) => {
        if (w > 0 && h > 0) {
          setFirstPhotoAspect(Math.max(0.55, Math.min(1.9, w / h)));
        }
      },
      () => {},
    );
  }, [listing?.photos_url?.[0]]);

  useEffect(() => {
    if (initialFavoriteRef.current === null) {
      initialFavoriteRef.current = isFavorite;
      return;
    }
    setLikeCount((prev) => isFavorite ? prev + 1 : Math.max(0, prev - 1));
  }, [isFavorite]);

  useEffect(() => {
    if (!loading && listing) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, listing]);

  const fetchListing = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(
          `id, name, description, price, deposit_amount, photos_url, category_name, category_id,
           latitude, longitude, location_data, created_at, owner_id, views_count, saves_count,
           owner:profiles!listings_owner_id_fkey(id, username, photo_url, avatar_url, location_data, created_at, is_pro, business_name, business_address, business_type, business_hours, siren_number),
           category:categories!listings_category_id_fkey(value)`
        )
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const mapped: Listing = {
          ...data,
          owner: Array.isArray(data.owner) ? (data.owner[0] ?? null) : data.owner,
          category: Array.isArray(data.category) ? (data.category[0] ?? null) : data.category,
        } as any;
        setListing(mapped);
        setLikeCount((data as any).saves_count ?? 0);
        setViewCount((data as any).views_count ?? 0);
        trackRecentlyViewed(id!);

        const ownerId = mapped.owner?.id ?? null;
        const isOwnListing = !!(userId && ownerId && userId === ownerId);

        const listingLatRaw = mapped.latitude ?? mapped.owner?.location_data?.lat ?? null;
        const listingLngRaw = mapped.longitude ?? mapped.owner?.location_data?.lng ?? null;
        if (!isOwnListing && listingLatRaw && listingLngRaw) {
          getCityFromCoords(listingLatRaw, listingLngRaw).then((city) => {
            if (city) setCityName(city);
          });
        }

        if (!isOwnListing) {
          supabase.from('listing_views').insert({
            listing_id: id,
            viewer_id: userId ?? null,
          }).then(() => {});

          if (userId) {
            supabase
              .from('conversations')
              .select('id')
              .eq('listing_id', id)
              .eq('requester_id', userId)
              .in('status', ['pending', 'accepted'])
              .maybeSingle()
              .then(({ data: existingConv }) => {
                setExistingConvId(existingConv?.id ?? null);
              });
          }
        }

        const [bookingsRes, convsRes] = await Promise.all([
          supabase
            .from('bookings')
            .select('start_date, end_date, status')
            .eq('listing_id', id)
            .in('status', ['pending_payment', 'accepted', 'active', 'in_progress', 'pending_return', 'pending_owner_validation']),
          supabase
            .from('conversations')
            .select('start_date, end_date')
            .eq('listing_id', id)
            .eq('status', 'pending'),
        ]);

        const allBookedRanges = [
          ...(bookingsRes.data ?? []).map((b: any) => ({
            start: new Date(b.start_date.split('T')[0] + 'T00:00:00'),
            end: new Date(b.end_date.split('T')[0] + 'T00:00:00'),
          })),
          ...(convsRes.data ?? []).map((c: any) => ({
            start: new Date(c.start_date + 'T00:00:00'),
            end: new Date(c.end_date + 'T00:00:00'),
          })),
        ];

        if (allBookedRanges.length > 0) {
          setBookedRanges(allBookedRanges);
        }
      }
    } catch (err) {
      console.error('fetchListing error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('bookings')
      .select('id')
      .eq('listing_id', id)
      .not('status', 'in', '("completed","cancelled","refused")')
      .limit(1)
      .maybeSingle();
    if (data) {
      setDeleteBlockedError(true);
      return;
    }
    setDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    await supabase.from('listings').delete().eq('id', id);
    setDeleting(false);
    router.replace('/(tabs)/mes-annonces' as any);
  };

  const handleShare = async () => {
    try {
      const title = listing?.name ?? 'LoueTonBien';
      const text = listing?.name
        ? `Découvre "${listing.name}" sur LoueTonBien !`
        : 'Découvre cette annonce sur LoueTonBien !';

      if (Platform.OS === 'web') {
        const webUrl = typeof window !== 'undefined' ? window.location.href : `https://app.louetonbien.fr/listing/${id}`;
        if (navigator?.share) {
          await navigator.share({ title, text, url: webUrl });
        } else {
          await navigator.clipboard.writeText(webUrl);
          showSnackbar("Lien copié — vous pouvez partager l'annonce !", 'share');
        }
      } else {
        const deepLink = `myapp://listing/${id}`;
        const message = `${text}\n${deepLink}`;
        await Share.share({ message, url: deepLink, title });
      }
    } catch {}
  };

  const handleCalendarConfirm = useCallback(
    (start: Date, end: Date, days: number) => {
      setSelectedStart(start);
      setSelectedEnd(end);
      setSelectedDays(days);
      setCalendarVisible(false);
    },
    []
  );

  const handleRequestPress = () => {
    if (!selectedDays || !selectedStart || !selectedEnd) return;
    setMessageModalVisible(true);
  };

  const handleRequest = async (customMessage: string) => {
    if (!selectedStart || !selectedEnd || !listing || !userId || !listing.owner?.id) return;
    setRequesting(true);

    const toISO = (d: Date) => d.toISOString().split('T')[0];

    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        listing_id: listing.id,
        requester_id: userId,
        owner_id: listing.owner.id,
        start_date: toISO(selectedStart),
        end_date: toISO(selectedEnd),
      })
      .select('id')
      .single();

    if (!convErr && conv) {
      const startLabel = selectedStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      const endLabel = selectedEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      await postSystemMessage(conv.id, `Nouvelle demande du ${startLabel} au ${endLabel}`);
      if (customMessage) {
        await supabase.from('chat_messages').insert({
          conversation_id: conv.id,
          sender_id: userId,
          content: customMessage,
          is_system: false,
        });
      }
    }

    setRequesting(false);
    setMessageModalVisible(false);

    if (!convErr && conv) {
      setExistingConvId(conv.id);
      router.push(`/chat/${conv.id}` as any);
    } else {
      setRequestSent(true);
      setTimeout(() => {
        setRequestSent(false);
        router.push('/(tabs)/reservations');
      }, 2200);
    }
  };

  const formatShortDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (isOwner) {
      router.replace('/(tabs)/mes-annonces' as any);
    } else {
      router.replace('/(tabs)/' as any);
    }
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [SCROLL_THRESHOLD - 60, SCROLL_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <Skeleton height={HEADER_IMAGE_HEIGHT} radius={0} />
        <View style={{ padding: 16, gap: 14 }}>
          <Skeleton height={28} width="75%" />
          <Skeleton height={18} width="40%" />
          <Skeleton height={48} width="100%" radius={12} />
          <Skeleton height={14} width="100%" />
          <Skeleton height={14} width="92%" />
          <Skeleton height={14} width="60%" />
          <View style={{ height: 12 }} />
          <Skeleton height={56} width="100%" radius={999} />
        </View>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notFoundText}>Annonce introuvable</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/' as any)} style={styles.backBtnSimple}>
          <Text style={styles.backBtnSimpleText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = !!(userId && listing.owner?.id && userId === listing.owner.id);
  const photos = listing.photos_url ?? [];

  const catValue = listing.category?.value ?? '';
  const catColors = CATEGORY_COLORS[catValue] ?? CATEGORY_COLORS['autre'];
  const ownerPhoto = listing.owner?.avatar_url ?? listing.owner?.photo_url;
  const ownerName = listing.owner?.username ? `@${listing.owner.username}` : 'Utilisateur';
  const ownerInitials = (listing.owner?.username ?? 'U').slice(0, 2).toUpperCase();

  const userLat = profile?.location_data?.lat ?? null;
  const userLng = profile?.location_data?.lng ?? null;
  const listingLat = listing.latitude ?? listing.owner?.location_data?.lat ?? null;
  const listingLng = listing.longitude ?? listing.owner?.location_data?.lng ?? null;

  const distanceText =
    userLat && userLng && listingLat && listingLng
      ? formatDistance(haversineKm(userLat, userLng, listingLat, listingLng))
      : null;

  const hasDeposit = listing.deposit_amount && listing.deposit_amount > 0;

  if (isDesktop) {
    return (
      <View style={desktopStyles.root}>
        <View style={desktopStyles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.navBtn} activeOpacity={0.85}>
            <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={desktopStyles.topBarTitle} numberOfLines={1}>{listing.name}</Text>
          <View style={styles.navBtnGroup}>
            {userId && listing?.owner?.id && userId !== listing.owner.id && (
              <TouchableOpacity onPress={toggleFavorite} style={styles.navBtn} activeOpacity={0.85}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isFavorite ? Colors.notification : Colors.text}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleShare} style={styles.navBtn} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={desktopStyles.body}>
          <ScrollView
            style={desktopStyles.leftCol}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 64 }}
          >
            {(() => {
              const galleryWidth = Math.min(windowWidth, 1280) - 380;
              // Adapt the height to the first photo's aspect, clamped so the
              // section stays close to its previous compact size.
              const adaptiveHeight = Math.max(
                300,
                Math.min(540, galleryWidth / firstPhotoAspect),
              );
              return (
                <ImageGallery
                  photos={photos}
                  height={adaptiveHeight}
                  containerWidth={galleryWidth}
                  onPhotoChange={(i) => setActivePhoto(i)}
                />
              );
            })()}
            <View style={{ paddingHorizontal: 40, paddingTop: 32 }}>
              <View style={styles.metaRow}>
                {listing.category_name && (
                  <TouchableOpacity
                    style={[styles.categoryPill, { backgroundColor: catColors.bg, borderColor: catColors.border }]}
                    activeOpacity={0.7}
                    onPress={() => listing.category_id && router.push({
                      pathname: '/category/[id]',
                      params: { id: listing.category_id, name: listing.category_name ?? '', value: listing.category?.value ?? '' },
                    } as any)}
                  >
                    <Ionicons name="pricetag-outline" size={11} color={catColors.text} />
                    <Text style={[styles.categoryPillText, { color: catColors.text }]}>{listing.category_name}</Text>
                  </TouchableOpacity>
                )}
                {distanceText && (
                  <View style={styles.distancePill}>
                    <Ionicons name="location-outline" size={11} color={Colors.primary} />
                    <Text style={styles.distancePillText}>{distanceText}</Text>
                  </View>
                )}
                {!isOwner && cityName && (
                  <View style={styles.cityPill}>
                    <Ionicons name="location-outline" size={11} color="#6B7280" />
                    <Text style={styles.cityPillText}>{cityName}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.listingTitle, { fontSize: 30 }]}>{listing.name}</Text>

              {listing.description && (
                <>
                  <View style={styles.descriptionBlock}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <View style={styles.descriptionSeparator} />
                    <Text style={styles.descriptionText}>{listing.description}</Text>
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {listing.owner?.is_pro && !isOwner && (() => {
                const bh = listing.owner?.business_hours;
                return (
                  <>
                    <View style={styles.section}>
                      <View style={styles.proSectionHeader}>
                        <Ionicons name="business-outline" size={15} color="#3A6BBF" />
                        <Text style={styles.proSectionTitle}>Boutique professionnelle</Text>
                        <ProBadge size="sm" />
                      </View>
                      <View style={styles.proInfoCard}>
                        {listing.owner?.business_name && (
                          <View style={styles.proInfoRow}>
                            <View style={styles.proInfoIconWrap}><Ionicons name="business-outline" size={14} color="#3A6BBF" /></View>
                            <View style={styles.proInfoContent}>
                              <Text style={styles.proInfoLabel}>Nom commercial</Text>
                              <Text style={styles.proInfoValue}>{listing.owner.business_name}</Text>
                            </View>
                          </View>
                        )}
                        {listing.owner?.business_type && (
                          <View style={styles.proInfoRow}>
                            <View style={styles.proInfoIconWrap}><Ionicons name="pricetag-outline" size={14} color="#3A6BBF" /></View>
                            <View style={styles.proInfoContent}>
                              <Text style={styles.proInfoLabel}>Type d'activité</Text>
                              <Text style={styles.proInfoValue}>{listing.owner.business_type}</Text>
                            </View>
                          </View>
                        )}
                        {listing.owner?.siren_number && (
                          <View style={styles.proInfoRow}>
                            <View style={styles.proInfoIconWrap}><Ionicons name="globe-outline" size={14} color="#3A6BBF" /></View>
                            <View style={styles.proInfoContent}>
                              <Text style={styles.proInfoLabel}>SIREN</Text>
                              <Text style={styles.proInfoValue}>{listing.owner.siren_number}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.divider} />
                  </>
                );
              })()}

              {!isOwner && listingLat && listingLng && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Localisation</Text>
                    <ApproximateLocationMap
                      lat={listingLat}
                      lng={listingLng}
                      city={cityName}
                    />
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {!isOwner && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Propriétaire</Text>
                  <TouchableOpacity
                    style={styles.ownerCard}
                    activeOpacity={0.8}
                    onPress={() => listing.owner?.id && router.push(`/owner/${listing.owner.id}` as any)}
                  >
                    <View style={styles.ownerAvatarWrap}>
                      {ownerPhoto ? (
                        <Image source={{ uri: getOptimizedImageUrl(ownerPhoto, { width: 200, height: 200, resize: 'cover' }) ?? ownerPhoto }} style={styles.ownerAvatar} />
                      ) : (
                        <View style={styles.ownerAvatarFallback}>
                          <Text style={styles.ownerAvatarText}>{ownerInitials}</Text>
                        </View>
                      )}
                      <View style={styles.ownerVerifiedDot} />
                    </View>
                    <View style={styles.ownerInfo}>
                      <View style={styles.ownerNameRow}>
                        <Text style={styles.ownerName}>{ownerName}</Text>
                        {listing.owner?.is_pro && <ProBadge size="sm" />}
                      </View>
                      {listing.owner?.created_at && (
                        <View style={styles.ownerMemberRow}>
                          <Ionicons name="time-outline" size={10} color={Colors.textMuted} />
                          <Text style={styles.ownerMember}>Membre depuis {formatMemberSince(listing.owner.created_at)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.ownerAction}>
                      <Text style={styles.ownerActionText}>Voir profil</Text>
                      <Ionicons name="chevron-forward-outline" size={14} color={Colors.primary} />
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {!isOwner && listing && (
                <TouchableOpacity
                  style={styles.reportBtn}
                  activeOpacity={0.75}
                  onPress={() => router.push({ pathname: '/report', params: { type: 'listing', targetId: listing.id, targetLabel: listing.name } } as any)}
                >
                  <Ionicons name="flag-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.reportBtnText}>Signaler cette annonce</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <View style={desktopStyles.rightCol}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 32, paddingBottom: 48, gap: 20, alignItems: 'stretch' }}>
              <View style={styles.pricingCard}>
                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>Prix par jour</Text>
                    <View style={styles.priceAmountRow}>
                      <Text style={styles.priceAmount}>{listing.price}</Text>
                      <Text style={styles.priceCurrency}>€</Text>
                      <Text style={styles.priceUnit}> / jour</Text>
                    </View>
                  </View>
                  <View style={styles.priceIconWrap}>
                    <Ionicons name="cash-outline" size={18} color={Colors.primary} />
                  </View>
                </View>
                <View style={styles.pricingInnerDivider} />
                {selectedDays > 0 ? (() => {
                  const base = selectedDays * listing.price;
                  const disc = selectedDays >= 7 ? 0.2 : selectedDays >= 3 ? 0.1 : 0;
                  const total = Math.round(base * (1 - disc));
                  return (
                    <View style={styles.totalRow}>
                      <View style={styles.totalRowLeft}>
                        <Text style={styles.totalLabel}>Total</Text>
                        {disc > 0 && (
                          <View style={styles.totalPromoLabel}>
                            <Ionicons name="pricetag-outline" size={9} color={Colors.primary} />
                            <Text style={styles.totalPromoLabelText}>-{Math.round(disc * 100)}% appliqué</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.totalPriceGroup}>
                        {disc > 0 && <Text style={styles.totalAmountStrike}>{Math.round(base)}€</Text>}
                        <Text style={styles.totalAmount}>{total}€</Text>
                      </View>
                    </View>
                  );
                })() : (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total estimé</Text>
                    <Text style={styles.totalAmountMuted}>—</Text>
                  </View>
                )}
                {hasDeposit ? (
                  <View style={styles.cautionRow}>
                    <View style={styles.cautionIconWrap}><Ionicons name="alert-circle-outline" size={14} color="#C06828" /></View>
                    <Text style={styles.cautionLabel}>Caution demandée</Text>
                    <Text style={styles.cautionAmount}>{listing.deposit_amount}€</Text>
                  </View>
                ) : (
                  <View style={styles.cautionRow}>
                    <View style={styles.noCautionIconWrap}><Ionicons name="shield-outline" size={14} color="#2A8A4A" /></View>
                    <Text style={styles.noCautionTitle}>Sans caution</Text>
                  </View>
                )}
              </View>

              {!isOwner && (
                <View style={styles.section}>
                  <TouchableOpacity
                    style={[styles.datePicker, selectedDays > 0 && styles.datePickerActive]}
                    activeOpacity={0.8}
                    onPress={() => setCalendarVisible(true)}
                  >
                    <View style={styles.datePickerIcon}><Ionicons name="calendar-outline" size={17} color={Colors.primary} /></View>
                    <View style={styles.datePickerContent}>
                      {selectedDays > 0 && selectedStart ? (
                        <>
                          <Text style={styles.datePickerDates}>
                            {formatShortDate(selectedStart)}
                            {selectedEnd && !isSameDay(selectedStart, selectedEnd) ? ` - ${formatShortDate(selectedEnd)}` : ''}
                          </Text>
                          <Text style={styles.datePickerDaysCount}>{selectedDays} jour{selectedDays > 1 ? 's' : ''}</Text>
                        </>
                      ) : (
                        <Text style={styles.datePickerText}>Choisir des dates de location</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward-outline" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                  <View style={styles.promoBadgeRow}>
                    <View style={styles.promoBadge}>
                      <View style={styles.promoBadgeIconWrap}><Ionicons name="pricetag-outline" size={10} color={Colors.primary} /></View>
                      <Text style={styles.promoBadgeText}><Text style={styles.promoBadgeDiscount}>-10% </Text>dès 3 jours</Text>
                    </View>
                    <View style={styles.promoBadge}>
                      <View style={styles.promoBadgeIconWrap}><Ionicons name="pricetag-outline" size={10} color={Colors.primary} /></View>
                      <Text style={styles.promoBadgeText}><Text style={styles.promoBadgeDiscount}>-20% </Text>dès 7 jours</Text>
                    </View>
                  </View>
                </View>
              )}

              {!isOwner && (
                existingConvId ? (
                  <TouchableOpacity
                    style={[styles.ctaBtn, desktopStyles.ctaBtnTall, { flex: undefined, width: '100%' }]}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/chat/${existingConvId}` as any)}
                  >
                    <Text style={[styles.ctaBtnText, desktopStyles.ctaBtnTextLarge]}>Voir ma demande</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.ctaBtn, desktopStyles.ctaBtnTall, { flex: undefined, width: '100%' }, !selectedDays && styles.ctaBtnDisabled]}
                    activeOpacity={0.85}
                    onPress={handleRequestPress}
                    disabled={!selectedDays}
                  >
                    <Text style={[styles.ctaBtnText, desktopStyles.ctaBtnTextLarge]}>{selectedDays > 0 ? 'Faire une demande' : 'Choisir des dates'}</Text>
                  </TouchableOpacity>
                )
              )}

              {isOwner && (
                <View style={{ gap: 10 }}>
                  <View style={styles.ownerStatsRow}>
                    <View style={styles.ownerStatItem}>
                      <Ionicons name="eye-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.ownerStatValue}>{viewCount}</Text>
                      <Text style={styles.ownerStatLabel}>vues</Text>
                    </View>
                    <View style={styles.ownerStatDivider} />
                    <View style={styles.ownerStatItem}>
                      <Ionicons name="heart" size={14} color="#E05252" />
                      <Text style={styles.ownerStatValue}>{likeCount}</Text>
                      <Text style={styles.ownerStatLabel}>favoris</Text>
                    </View>
                  </View>
                  <View style={styles.ownerActionRow}>
                    <TouchableOpacity style={styles.ownerDeleteBtn} activeOpacity={0.85} onPress={() => setDeleteConfirm(true)}>
                      <Ionicons name="trash-outline" size={16} color="#C25450" />
                      <Text style={styles.ownerDeleteBtnText}>Supprimer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.ownerModifyBtn}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/create-listing', params: { editId: id } } as any)}
                    >
                      <Ionicons name="pencil-outline" size={16} color={Colors.white} />
                      <Text style={styles.ownerModifyBtnText}>Modifier l'annonce</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.shareLinkBtn}
                    activeOpacity={0.85}
                    onPress={() => setShareLinkVisible(true)}
                  >
                    <Ionicons name="link-outline" size={16} color={Colors.primaryDark} />
                    <Text style={styles.shareLinkBtnText}>Générer un lien de réservation</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>

        <DateRangeCalendar
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
          onConfirm={handleCalendarConfirm}
          pricePerDay={listing.price}
          bookedRanges={bookedRanges}
        />
        {selectedStart && selectedEnd && listing && (
          <RequestMessageModal
            visible={messageModalVisible}
            onClose={() => setMessageModalVisible(false)}
            onConfirm={handleRequest}
            listingTitle={listing.name}
            listingThumb={listing.photos_url?.[0] ?? null}
            ownerUsername={listing.owner?.username ?? 'proprietaire'}
            ownerAvatarUrl={listing.owner?.avatar_url ?? listing.owner?.photo_url ?? null}
            startDate={selectedStart}
            endDate={selectedEnd}
            days={selectedDays}
            totalPrice={(() => {
              const disc = selectedDays >= 7 ? 0.2 : selectedDays >= 3 ? 0.1 : 0;
              return Math.round(selectedDays * listing.price * (1 - disc));
            })()}
            sending={requesting}
          />
        )}
        <RequestSentOverlay visible={requestSent} />
        {listing && (
          <ShareLinkModal
            visible={shareLinkVisible}
            onClose={() => setShareLinkVisible(false)}
            listingId={listing.id}
            listingName={listing.name}
            pricePerDay={listing.price}
            bookedRanges={bookedRanges}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Floating top bar */}
      <Animated.View style={[styles.floatingHeader, { opacity: headerOpacity }]}>
        <Text style={styles.floatingHeaderTitle} numberOfLines={1}>{listing.name}</Text>
      </Animated.View>

      {/* Nav buttons */}
      <View style={styles.navBar} pointerEvents="box-none">
        <TouchableOpacity onPress={handleBack} style={styles.navBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.navBtnGroup}>
          {userId && listing?.owner?.id && userId !== listing.owner.id && (
            <TouchableOpacity onPress={toggleFavorite} style={styles.navBtn} activeOpacity={0.85}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorite ? Colors.notification : Colors.text}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.navBtn} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero gallery */}
        <ImageGallery
          photos={photos}
          height={HEADER_IMAGE_HEIGHT}
          onPhotoChange={(i) => setActivePhoto(i)}
        />

        {/* Content card */}
        <Animated.View
          style={[
            styles.contentCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Category + Distance row */}
          <View style={styles.metaRow}>
            {listing.category_name && (
              <TouchableOpacity
                style={[styles.categoryPill, { backgroundColor: catColors.bg, borderColor: catColors.border }]}
                activeOpacity={0.7}
                onPress={() => listing.category_id && router.push({
                  pathname: '/category/[id]',
                  params: { id: listing.category_id, name: listing.category_name ?? '', value: listing.category?.value ?? '' },
                } as any)}
              >
                <Ionicons name="pricetag-outline" size={11} color={catColors.text} />
                <Text style={[styles.categoryPillText, { color: catColors.text }]}>
                  {listing.category_name}
                </Text>
              </TouchableOpacity>
            )}
            {distanceText && (
              <View style={styles.distancePill}>
                <Ionicons name="location-outline" size={11} color={Colors.primary} />
                <Text style={styles.distancePillText}>{distanceText}</Text>
              </View>
            )}
            {!isOwner && cityName && (
              <View style={styles.cityPill}>
                <Ionicons name="location-outline" size={11} color="#6B7280" />
                <Text style={styles.cityPillText}>{cityName}</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.listingTitle}>{listing.name}</Text>

          {/* Description */}
          {listing.description && (
            <>
              <View style={styles.descriptionBlock}>
                <Text style={styles.sectionTitle}>Description</Text>
                <View style={styles.descriptionSeparator} />
                <Text style={styles.descriptionText}>{listing.description}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}

          {/* Prix + badges + caution — bloc unifié */}
          <View style={styles.pricingCard}>
            {/* Prix row */}
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>Prix par jour</Text>
                <View style={styles.priceAmountRow}>
                  <Text style={styles.priceAmount}>{listing.price}</Text>
                  <Text style={styles.priceCurrency}>€</Text>
                  <Text style={styles.priceUnit}> / jour</Text>
                </View>
              </View>
              <View style={styles.priceIconWrap}>
                <Ionicons name="cash-outline" size={18} color={Colors.primary} />
              </View>
            </View>

            {/* Séparateur interne */}
            <View style={styles.pricingInnerDivider} />

            {/* Ligne total dynamique */}
            {selectedDays > 0 ? (() => {
              const base = selectedDays * listing.price;
              const disc = selectedDays >= 7 ? 0.2 : selectedDays >= 3 ? 0.1 : 0;
              const total = Math.round(base * (1 - disc));
              return (
                <View style={styles.totalRow}>
                  <View style={styles.totalRowLeft}>
                    <Text style={styles.totalLabel}>Total</Text>
                    {disc > 0 && (
                      <View style={styles.totalPromoLabel}>
                        <Ionicons name="pricetag-outline" size={9} color={Colors.primary} />
                        <Text style={styles.totalPromoLabelText}>
                          -{Math.round(disc * 100)}% appliqué
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.totalPriceGroup}>
                    {disc > 0 && (
                      <Text style={styles.totalAmountStrike}>{Math.round(base)}€</Text>
                    )}
                    <Text style={styles.totalAmount}>{total}€</Text>
                  </View>
                </View>
              );
            })() : (
              <View style={styles.totalRow}>
                <View style={styles.totalRowLeft}>
                  <Text style={styles.totalLabel}>Total estimé</Text>
                </View>
                <Text style={styles.totalAmountMuted}>—</Text>
              </View>
            )}

            {/* Caution inline */}
            {hasDeposit ? (
              <View style={styles.cautionRow}>
                <View style={styles.cautionIconWrap}>
                  <Ionicons name="alert-circle-outline" size={14} color="#C06828" />
                </View>
                <Text style={styles.cautionLabel}>Caution demandée</Text>
                <Text style={styles.cautionAmount}>{listing.deposit_amount}€</Text>
              </View>
            ) : (
              <View style={styles.cautionRow}>
                <View style={styles.noCautionIconWrap}>
                  <Ionicons name="shield-outline" size={14} color="#2A8A4A" />
                </View>
                <Text style={styles.noCautionTitle}>Sans caution</Text>
              </View>
            )}
          </View>

          {/* Revenue projection — visible uniquement pour le propriétaire */}
          {isOwner && (() => {
            const price = listing.price;
            const COMMISSION = 0.08;
            const earningsPerDay = price * (1 - COMMISSION);
            const price3 = (price * 3 * 0.9).toFixed(2);
            const price7 = (price * 7 * 0.8).toFixed(2);
            const earnings3 = (price * 3 * 0.9 * (1 - COMMISSION)).toFixed(2);
            const earnings7 = (price * 7 * 0.8 * (1 - COMMISSION)).toFixed(2);
            return (
              <>
                <View style={styles.divider} />
                <View style={styles.revenueSection}>
                  <View style={styles.revenueTitleRow}>
                    <Ionicons name="trending-up-outline" size={16} color={Colors.primaryDark ?? Colors.primary} />
                    <Text style={styles.revenueTitle}>Projection de revenus</Text>
                  </View>
                  <Text style={styles.revenueSubtitle}>
                    Ce que vous recevez réellement après commission de 8%
                  </Text>
                  <View style={styles.revenueGrid}>
                    <View style={styles.revenueCard}>
                      <Text style={styles.revenueCardLabel}>1 jour</Text>
                      <Text style={styles.revenueCardAmount}>{earningsPerDay.toFixed(2)} €</Text>
                      <Text style={styles.revenueCardSub}>affiché {price.toFixed(2)} €</Text>
                    </View>
                    <View style={styles.revenueCard}>
                      <View style={styles.revenueCardBadge}>
                        <Ionicons name="pricetag-outline" size={9} color={Colors.primaryDark ?? Colors.primary} />
                        <Text style={styles.revenueCardBadgeText}>-10%</Text>
                      </View>
                      <Text style={styles.revenueCardLabel}>3 jours</Text>
                      <Text style={styles.revenueCardAmount}>{earnings3} €</Text>
                      <Text style={styles.revenueCardSub}>affiché {price3} €</Text>
                    </View>
                    <View style={[styles.revenueCard, styles.revenueCardHighlight]}>
                      <View style={[styles.revenueCardBadge, styles.revenueCardBadgeDark]}>
                        <Ionicons name="pricetag-outline" size={9} color={Colors.white} />
                        <Text style={[styles.revenueCardBadgeText, { color: Colors.white }]}>-20%</Text>
                      </View>
                      <Text style={[styles.revenueCardLabel, { color: Colors.white }]}>7 jours</Text>
                      <Text style={[styles.revenueCardAmount, { color: Colors.white }]}>{earnings7} €</Text>
                      <Text style={[styles.revenueCardSub, { color: 'rgba(255,255,255,0.65)' }]}>affiché {price7} €</Text>
                    </View>
                  </View>
                  <View style={styles.commissionNote}>
                    <Ionicons name="information-circle-outline" size={13} color={Colors.primaryDark ?? Colors.primary} />
                    <Text style={styles.commissionNoteText}>
                      Sans commission, vous toucheriez{' '}
                      <Text style={styles.commissionNoteHighlight}>{price.toFixed(2)} € / jour</Text>
                      . Proposer un tarif compétitif reste votre meilleur levier.
                    </Text>
                  </View>
                </View>
              </>
            );
          })()}

          {/* Booking dates — masqué pour le propriétaire */}
          {!isOwner && (<>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Réservation</Text>
              <TouchableOpacity
                style={[styles.datePicker, selectedDays > 0 && styles.datePickerActive]}
                activeOpacity={0.8}
                onPress={() => setCalendarVisible(true)}
              >
                <View style={styles.datePickerIcon}>
                  <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
                </View>
                <View style={styles.datePickerContent}>
                  {selectedDays > 0 && selectedStart ? (
                    <>
                      <Text style={styles.datePickerDates}>
                        {formatShortDate(selectedStart)}
                        {selectedEnd && !isSameDay(selectedStart, selectedEnd)
                          ? ` - ${formatShortDate(selectedEnd)}`
                          : ''}
                      </Text>
                      <Text style={styles.datePickerDaysCount}>
                        {selectedDays} jour{selectedDays > 1 ? 's' : ''}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.datePickerText}>Choisir des dates de location</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward-outline" size={16} color={Colors.primary} />
              </TouchableOpacity>

              {/* Badges promo */}
              <View style={styles.promoBadgeRow}>
                <View style={styles.promoBadge}>
                  <View style={styles.promoBadgeIconWrap}>
                    <Ionicons name="pricetag-outline" size={10} color={Colors.primary} />
                  </View>
                  <Text style={styles.promoBadgeText}>
                    <Text style={styles.promoBadgeDiscount}>-10% </Text>
                    dès 3 jours
                  </Text>
                </View>
                <View style={styles.promoBadge}>
                  <View style={styles.promoBadgeIconWrap}>
                    <Ionicons name="pricetag-outline" size={10} color={Colors.primary} />
                  </View>
                  <Text style={styles.promoBadgeText}>
                    <Text style={styles.promoBadgeDiscount}>-20% </Text>
                    dès 7 jours
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.divider} />
          </>)}

          {/* Pro business info — visible pour tous si is_pro */}
          {listing.owner?.is_pro && !isOwner && (() => {
            const bh = listing.owner?.business_hours;
            return (
              <>
                <View style={styles.divider} />
                <View style={styles.section}>
                  <View style={styles.proSectionHeader}>
                    <Ionicons name="business-outline" size={15} color="#3A6BBF" />
                    <Text style={styles.proSectionTitle}>Boutique professionnelle</Text>
                    <ProBadge size="sm" />
                  </View>

                  <View style={styles.proInfoCard}>
                    {listing.owner?.business_name && (
                      <View style={styles.proInfoRow}>
                        <View style={styles.proInfoIconWrap}>
                          <Ionicons name="business-outline" size={14} color="#3A6BBF" />
                        </View>
                        <View style={styles.proInfoContent}>
                          <Text style={styles.proInfoLabel}>Nom commercial</Text>
                          <Text style={styles.proInfoValue}>{listing.owner.business_name}</Text>
                        </View>
                      </View>
                    )}

                    {listing.owner?.business_type && (
                      <View style={styles.proInfoRow}>
                        <View style={styles.proInfoIconWrap}>
                          <Ionicons name="pricetag-outline" size={14} color="#3A6BBF" />
                        </View>
                        <View style={styles.proInfoContent}>
                          <Text style={styles.proInfoLabel}>Type d'activité</Text>
                          <Text style={styles.proInfoValue}>{listing.owner.business_type}</Text>
                        </View>
                      </View>
                    )}

                    {listing.owner?.business_address && (
                      <View style={styles.proInfoRow}>
                        <View style={styles.proInfoIconWrap}>
                          <Ionicons name="location-outline" size={14} color="#3A6BBF" />
                        </View>
                        <View style={styles.proInfoContent}>
                          <Text style={styles.proInfoLabel}>Adresse</Text>
                          <Text style={styles.proInfoValue}>{listing.owner.business_address}</Text>
                        </View>
                      </View>
                    )}

                    {listing.owner?.siren_number && (
                      <View style={styles.proInfoRow}>
                        <View style={styles.proInfoIconWrap}>
                          <Ionicons name="globe-outline" size={14} color="#3A6BBF" />
                        </View>
                        <View style={styles.proInfoContent}>
                          <Text style={styles.proInfoLabel}>SIREN</Text>
                          <Text style={styles.proInfoValue}>{listing.owner.siren_number}</Text>
                        </View>
                      </View>
                    )}

                    {bh && (
                      <View style={styles.proHoursBlock}>
                        <View style={styles.proInfoIconWrap}>
                          <Ionicons name="time-outline" size={14} color="#3A6BBF" />
                        </View>
                        <View style={styles.proHoursContent}>
                          <Text style={styles.proInfoLabel}>Horaires d'ouverture</Text>
                          <View style={styles.hoursGrid}>
                            {DAYS_ORDER.map((day) => {
                              const slot = bh[day];
                              if (!slot) return null;
                              const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                              const isToday = today === day;
                              return (
                                <View key={day} style={[styles.hourRow, isToday && styles.hourRowToday]}>
                                  <Text style={[styles.hourDay, isToday && styles.hourDayToday]}>{DAYS_FR[day]}</Text>
                                  {slot.closed ? (
                                    <Text style={styles.hourClosed}>Fermé</Text>
                                  ) : (
                                    <Text style={[styles.hourTime, isToday && styles.hourTimeToday]}>
                                      {slot.open} – {slot.close}
                                    </Text>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </>
            );
          })()}

          {/* Approximate location map — masqué pour le propriétaire */}
          {!isOwner && listingLat && listingLng && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Localisation</Text>
                <ApproximateLocationMap lat={listingLat} lng={listingLng} city={cityName} />
              </View>
              <View style={styles.divider} />
            </>
          )}

          {/* Owner — masqué pour le propriétaire */}
          {!isOwner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Propriétaire</Text>
              <TouchableOpacity
                style={styles.ownerCard}
                activeOpacity={0.8}
                onPress={() => listing.owner?.id && router.push(`/owner/${listing.owner.id}` as any)}
              >
                <View style={styles.ownerAvatarWrap}>
                  {ownerPhoto ? (
                    <Image source={{ uri: getOptimizedImageUrl(ownerPhoto, { width: 200, height: 200, resize: 'cover' }) ?? ownerPhoto }} style={styles.ownerAvatar} />
                  ) : (
                    <View style={styles.ownerAvatarFallback}>
                      <Text style={styles.ownerAvatarText}>{ownerInitials}</Text>
                    </View>
                  )}
                  <View style={styles.ownerVerifiedDot} />
                </View>
                <View style={styles.ownerInfo}>
                  <View style={styles.ownerNameRow}>
                    <Text style={styles.ownerName}>{ownerName}</Text>
                    {listing.owner?.is_pro && <ProBadge size="sm" />}
                  </View>
                  {listing.owner?.created_at && (
                    <View style={styles.ownerMemberRow}>
                      <Ionicons name="time-outline" size={10} color={Colors.textMuted} />
                      <Text style={styles.ownerMember}>
                        Membre depuis {formatMemberSince(listing.owner.created_at)}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.ownerAction}>
                  <Text style={styles.ownerActionText}>Voir profil</Text>
                  <Ionicons name="chevron-forward-outline" size={14} color={Colors.primary} />
                </View>
              </TouchableOpacity>
            </View>
          )}


          {!isOwner && listing && (
            <TouchableOpacity
              style={styles.reportBtn}
              activeOpacity={0.75}
              onPress={() =>
                router.push({
                  pathname: '/report',
                  params: { type: 'listing', targetId: listing.id, targetLabel: listing.name },
                } as any)
              }
            >
              <Ionicons name="flag-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.reportBtnText}>Signaler cette annonce</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 120 }} />
        </Animated.View>
      </Animated.ScrollView>

      {/* Bottom CTA */}
      {isOwner ? (
        <View style={styles.bottomBar}>
          {deleteBlockedError ? (
            <View style={styles.deleteConfirmRow}>
              <Text style={[styles.deleteConfirmText, { color: '#C25450', flex: 1 }]}>
                Des demandes sont en cours sur cette annonce.
              </Text>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setDeleteBlockedError(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteCancelText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          ) : deleteConfirm ? (
            <View style={styles.deleteConfirmRow}>
              <Text style={styles.deleteConfirmText}>Supprimer définitivement ?</Text>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setDeleteConfirm(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={handleDelete}
                activeOpacity={0.8}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.deleteConfirmBtnText}>Supprimer</Text>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.ownerBottomBar}>
              <View style={styles.ownerStatsRow}>
                <View style={styles.ownerStatItem}>
                  <Ionicons name="eye-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.ownerStatValue}>{viewCount}</Text>
                  <Text style={styles.ownerStatLabel}>vues</Text>
                </View>
                <View style={styles.ownerStatDivider} />
                <View style={styles.ownerStatItem}>
                  <Ionicons name="heart" size={14} color="#E05252" />
                  <Text style={styles.ownerStatValue}>{likeCount}</Text>
                  <Text style={styles.ownerStatLabel}>favoris</Text>
                </View>
              </View>
              <View style={styles.ownerActionRow}>
                <TouchableOpacity
                  style={styles.ownerDeleteBtn}
                  activeOpacity={0.85}
                  onPress={handleDeleteRequest}
                >
                  <Ionicons name="trash-outline" size={16} color="#C25450" />
                  <Text style={styles.ownerDeleteBtnText}>Supprimer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ownerModifyBtn}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/create-listing', params: { editId: id } } as any)}
                >
                  <Ionicons name="pencil-outline" size={16} color={Colors.white} />
                  <Text style={styles.ownerModifyBtnText}>Modifier l'annonce</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.shareLinkBtn}
                activeOpacity={0.85}
                onPress={() => setShareLinkVisible(true)}
              >
                <Ionicons name="link-outline" size={16} color={Colors.primaryDark} />
                <Text style={styles.shareLinkBtnText}>Générer un lien de réservation</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.bottomBar}>
          <View style={styles.bottomPriceCol}>
            {selectedDays > 0 ? (
              <>
                <Text style={styles.bottomPrice}>
                  {(() => {
                    const disc = selectedDays >= 7 ? 0.2 : selectedDays >= 3 ? 0.1 : 0;
                    return Math.round(selectedDays * listing.price * (1 - disc));
                  })()}€
                </Text>
                <Text style={styles.bottomPriceUnit}>/ {selectedDays}j</Text>
              </>
            ) : (
              <>
                <Text style={styles.bottomPrice}>{listing.price}€</Text>
                <Text style={styles.bottomPriceUnit}>/ jour</Text>
              </>
            )}
          </View>
          {existingConvId ? (
            <TouchableOpacity
              style={styles.ctaBtn}
              activeOpacity={0.85}
              onPress={() => router.push(`/chat/${existingConvId}` as any)}
            >
              <Text style={styles.ctaBtnText}>Voir ma demande</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, !selectedDays && styles.ctaBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleRequestPress}
              disabled={!selectedDays}
            >
              <Text style={styles.ctaBtnText}>
                {selectedDays > 0 ? 'Faire une demande' : 'Choisir des dates'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <DateRangeCalendar
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onConfirm={handleCalendarConfirm}
        pricePerDay={listing.price}
        bookedRanges={bookedRanges}
      />

      {selectedStart && selectedEnd && listing && (
        <RequestMessageModal
          visible={messageModalVisible}
          onClose={() => setMessageModalVisible(false)}
          onConfirm={handleRequest}
          listingTitle={listing.name}
          listingThumb={listing.photos_url?.[0] ?? null}
          ownerUsername={listing.owner?.username ?? 'proprietaire'}
          ownerAvatarUrl={listing.owner?.avatar_url ?? listing.owner?.photo_url ?? null}
          startDate={selectedStart}
          endDate={selectedEnd}
          days={selectedDays}
          totalPrice={(() => {
            const disc = selectedDays >= 7 ? 0.2 : selectedDays >= 3 ? 0.1 : 0;
            return Math.round(selectedDays * listing.price * (1 - disc));
          })()}
          sending={requesting}
        />
      )}

      <RequestSentOverlay visible={requestSent} />

      {listing && (
        <ShareLinkModal
          visible={shareLinkVisible}
          onClose={() => setShareLinkVisible(false)}
          listingId={listing.id}
          listingName={listing.name}
          pricePerDay={listing.price}
          bookedRanges={bookedRanges}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  notFoundText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: Colors.textSecondary,
  },
  backBtnSimple: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },
  backBtnSimpleText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.white,
  },

  /* Floating header */
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 80,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  floatingHeaderTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },

  /* Nav buttons */
  navBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 30,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  navBtnGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
    }),
  },

  /* Scroll */
  scrollContent: {
    paddingBottom: 0,
  },
  contentCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingTop: 28,
    paddingHorizontal: 20,
    minHeight: SCREEN_HEIGHT,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },

  /* Meta row */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight + '50',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '60',
  },
  distancePillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cityPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#6B7280',
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 12,
  },
  reportBtnText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },

  /* Title */
  listingTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.6,
    marginBottom: 16,
    lineHeight: 32,
  },

  /* Pricing unified card */
  pricingCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 22,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
    }),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: Colors.primaryLight + '60',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  priceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  priceAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
  },
  priceAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  priceCurrency: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  priceUnit: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },

  /* Total dynamique */
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalRowLeft: {
    gap: 2,
  },
  totalLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  totalDaysHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  totalPriceGroup: {
    alignItems: 'flex-end',
    gap: 1,
  },
  totalAmountStrike: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.primary,
    textDecorationLine: 'line-through',
    opacity: 0.8,
  },
  totalAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  totalAmountMuted: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.border,
    letterSpacing: -0.5,
  },
  totalPromoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight + '50',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  totalPromoLabelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },

  /* Promo badges */
  promoBadgeRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 14,
  },
  promoBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight + '35',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  promoBadgeIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '70',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBadgeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.text,
  },
  promoBadgeDiscount: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: Colors.primary,
  },

  /* Pricing inner divider */
  pricingInnerDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },

  /* Caution inline row */
  cautionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cautionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FFE8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cautionLabel: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#A05010',
  },
  cautionAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: '#C06828',
  },
  noCautionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#D4F0DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCautionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#1A6A34',
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 22,
  },

  /* Sections */
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  descriptionBlock: {
    gap: 0,
  },
  descriptionSeparator: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 10,
    marginBottom: 14,
    borderRadius: 1,
  },
  descriptionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  },

  /* Date picker */
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: Colors.primaryLight + '25',
  },
  datePickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight + '90',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerActive: {
    backgroundColor: Colors.primaryLight + '45',
    borderColor: Colors.primary,
  },
  datePickerContent: {
    flex: 1,
  },
  datePickerText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.text,
  },
  datePickerDates: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  datePickerDaysCount: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.primary,
    marginTop: 1,
  },

  /* Owner */
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }),
  },
  ownerAvatarWrap: {
    position: 'relative',
  },
  ownerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  ownerAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerAvatarText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.primary,
  },
  ownerVerifiedDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2A8A4A',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  ownerInfo: {
    flex: 1,
    gap: 3,
  },
  ownerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  ownerMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownerMember: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  ownerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ownerActionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },


  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 8 },
      web: { boxShadow: '0 -3px 10px rgba(0,0,0,0.08)' },
    }),
  },
  bottomPriceCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  bottomPrice: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  bottomPriceUnit: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  ctaBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 100,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(183,191,156,0.5)' },
    }),
  },
  ctaBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  ctaBtnDisabled: {
    opacity: 0.5,
  },

  ownerBottomBar: {
    flex: 1,
    gap: 10,
  },
  ownerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 0,
  },
  ownerStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ownerStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.border,
  },
  ownerStatValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
  },
  ownerStatLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  ownerActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ownerDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C25450',
    backgroundColor: '#FFF0EF',
    minWidth: 120,
  },
  ownerDeleteBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#C25450',
  },
  ownerModifyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 12px rgba(183,191,156,0.5)' },
    }),
  },
  ownerModifyBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
  shareLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2DF',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  shareLinkBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.primaryDark,
    flex: 1,
  },
  deleteConfirmRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF0EF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F5C0BE',
  },
  deleteConfirmText: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#C25450',
  },
  deleteCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  deleteCancelText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
  },
  deleteConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#C25450',
  },
  deleteConfirmBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.white,
  },

  revenueSection: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 18,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
      android: { elevation: 5 },
      web: { boxShadow: '0 4px 14px rgba(0,0,0,0.12)' },
    }),
  },
  revenueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  revenueSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: -6,
  },
  revenueGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  revenueCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 3,
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  revenueCardHighlight: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  revenueCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.primaryLight + '50',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    top: 8,
    right: 8,
  },
  revenueCardBadgeDark: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  revenueCardBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 9,
    color: Colors.primaryDark,
  },
  revenueCardLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 14,
  },
  revenueCardAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  revenueCardSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: Colors.textMuted,
  },
  commissionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primaryLight + '30',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '35',
  },
  commissionNoteText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.primaryDark,
    lineHeight: 17,
  },
  commissionNoteHighlight: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
  },
  proSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  proSectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  proInfoCard: {
    backgroundColor: '#F0F4FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C8D8F8',
    overflow: 'hidden',
  },
  proInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE8FC',
  },
  proInfoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E0EAFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  proInfoContent: {
    flex: 1,
    gap: 2,
  },
  proInfoLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#6A85B8',
  },
  proInfoValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  proHoursBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  proHoursContent: {
    flex: 1,
    gap: 8,
  },
  hoursGrid: {
    gap: 4,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  hourRowToday: {
    backgroundColor: '#3A6BBF',
  },
  hourDay: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.text,
    width: 32,
  },
  hourDayToday: {
    color: '#fff',
  },
  hourTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  hourTimeToday: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Inter-SemiBold',
  },
  hourClosed: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#C05252',
  },
});

const desktopStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    flexDirection: 'column',
    ...Platform.select({
      web: { height: '100vh', overflow: 'hidden' } as any,
    }),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 16,
    ...Platform.select({
      web: { boxShadow: '0 1px 0 rgba(0,0,0,0.06)' },
    }),
  },
  topBarTitle: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'stretch',
  },
  leftCol: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  rightCol: {
    width: 380,
    backgroundColor: Colors.white,
    ...Platform.select({
      web: { position: 'sticky', top: 0, alignSelf: 'flex-start', height: '100vh', overflowY: 'auto' } as any,
    }),
  },
  ctaBtnTall: {
    height: 72,
    minHeight: 72,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 20,
    marginTop: 12,
    ...Platform.select({
      web: { boxShadow: '0 6px 22px rgba(183,191,156,0.55)' } as any,
    }),
  },
  ctaBtnTextLarge: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
});
