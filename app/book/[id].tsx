import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { postSystemMessage } from '@/lib/postSystemMessage';
import { createPendingPaymentBooking, computeRentalTotal } from '@/lib/createBooking';
import { getDiscount } from '@/lib/pricing';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';


interface ListingData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  deposit_amount: number | null;
  photos_url: string[] | null;
  category_name: string | null;
  owner: {
    id: string;
    username: string | null;
    photo_url: string | null;
    avatar_url: string | null;
  } | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDayCount(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.round((e - s) / 86400000) + 1;
}

export default function DirectBookPage() {
  const { id, start, end } = useLocalSearchParams<{ id: string; start: string; end: string }>();
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [listing, setListing] = useState<ListingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = start ?? '';
  const endDate = end ?? '';
  const days = startDate && endDate ? getDayCount(startDate, endDate) : 0;
  const discount = getDiscount(days);
  const basePrice = listing ? listing.price * days : 0;
  const discountAmt = Math.round(basePrice * discount);
  const totalPrice = listing ? computeRentalTotal(listing.price, days) : 0;
  const feePercent = (listing?.renter_fee_percent ?? 7) / 100;
  const serviceFee = Math.round(totalPrice * feePercent * 100) / 100;
  const totalWithFee = (totalPrice + serviceFee);
  const depositAmount = listing?.deposit_amount ?? 0;

  const fetchListing = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('listings')
      .select('id, name, description, price, deposit_amount, renter_fee_percent, photos_url, category_name, owner:profiles!listings_owner_id_fkey(id, username, photo_url, avatar_url)')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      const owner = Array.isArray(data.owner) ? data.owner[0] : data.owner;
      setListing({ ...data, owner });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  const savePendingUrl = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('pending_book_url', window.location.pathname + window.location.search);
    }
  };

  const handleBook = async () => {
    if (!listing || !startDate || !endDate || !days) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start_d = new Date(startDate);
    const end_d = new Date(endDate);

    if (start_d < today) {
      setError("La date de début ne peut pas être dans le passé.");
      return;
    }
    if (end_d <= start_d) {
      setError("La date de fin doit être après la date de début.");
      return;
    }

    if (!session) {
      savePendingUrl();
      router.push('/register' as any);
      return;
    }

    const user = session.user;

    if (user.id === listing.owner?.id) {
      setError("Tu ne peux pas réserver ton propre objet.");
      return;
    }

    if (!profile?.username) {
      savePendingUrl();
      router.push('/onboarding/profile' as any);
      return;
    }

    setBooking(true);
    setError(null);

    try {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
          listing_id: listing.id,
          requester_id: user.id,
          owner_id: listing.owner!.id,
          start_date: startDate,
          end_date: endDate,
          status: 'accepted',
        })
        .select('id')
        .single();

      if (convError || !conv) {
        setError("Une erreur est survenue lors de la création de la conversation.");
        setBooking(false);
        return;
      }

      const { data: bookingData, error: bookingError } = await createPendingPaymentBooking({
        listingId: listing.id,
        renterId: user.id,
        ownerId: listing.owner!.id,
        startDate,
        endDate,
        totalPrice,
        conversationId: conv.id,
      });

      if (bookingError || !bookingData) {
        setError("Une erreur est survenue lors de la création de la réservation.");
        setBooking(false);
        return;
      }

      await postSystemMessage(
        conv.id,
        `Réservation directe via lien · Du ${formatDate(startDate)} au ${formatDate(endDate)}`
      );

      router.replace(`/payment/${bookingData.id}` as any);
    } catch {
      setError("Une erreur inattendue est survenue. Veuillez réessayer.");
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
      </View>
    );
  }

  if (!listing || !startDate || !endDate || days <= 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.primaryDark} />
        <Text style={styles.errorTitle}>Lien invalide</Text>
        <Text style={styles.errorSub}>Ce lien de réservation est invalide ou a expiré.</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/' as any)} activeOpacity={0.85}>
          <Text style={styles.backHomeBtnText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const thumb = listing.photos_url?.[0] ?? null;
  const ownerAvatar = listing.owner?.avatar_url ?? listing.owner?.photo_url ?? null;
  const ownerName = listing.owner?.username ?? 'Propriétaire';

  const priceSection = (
    <View style={styles.priceCard}>
      <Text style={styles.priceSectionTitle}>Détail du prix</Text>

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>{listing.price}€ × {days} jour{days > 1 ? 's' : ''}</Text>
        <Text style={styles.priceValue}>{Math.round(basePrice)}€</Text>
      </View>

      {discount > 0 && (
        <View style={styles.priceRow}>
          <Text style={[styles.priceLabel, { color: Colors.primaryDark }]}>
            Remise {Math.round(discount * 100)}% {days >= 7 ? '(7+ jours)' : '(3+ jours)'}
          </Text>
          <Text style={[styles.priceValue, { color: Colors.primaryDark }]}>-{discountAmt}€</Text>
        </View>
      )}

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Frais de service (7%)</Text>
        <Text style={styles.priceValue}>{serviceFee.toFixed(2)}€</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.priceRow}>
        <Text style={styles.totalLabel}>Total à payer</Text>
        <Text style={styles.totalValue}>{totalWithFee.toFixed(2)}€</Text>
      </View>

      {depositAmount > 0 && (
        <View style={styles.depositRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primaryDark} />
          <Text style={styles.depositText}>
            Caution : {depositAmount}€ bloquée, non débitée
          </Text>
        </View>
      )}
    </View>
  );

  const ctaSection = (
    <View style={styles.ctaSection}>
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={14} color="#C25450" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.ctaBtn, booking && styles.ctaBtnLoading]}
        onPress={handleBook}
        activeOpacity={0.88}
        disabled={booking}
      >
        {booking ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : session ? (
          <>
            <Ionicons name="flash-outline" size={18} color="#fff" />
            <Text style={styles.ctaBtnText}>
              Réserver et payer · {totalWithFee.toFixed(2)}€
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="person-add-outline" size={18} color="#fff" />
            <Text style={styles.ctaBtnText}>Créer un compte pour réserver</Text>
          </>
        )}
      </TouchableOpacity>
      {!session && (
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => { savePendingUrl(); router.push('/login' as any); }}
          activeOpacity={0.7}
        >
          <Text style={styles.loginLinkText}>Déjà un compte ? Se connecter</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.secureNote}>
        <Ionicons name="lock-closed-outline" size={11} color={Colors.textMuted} /> Paiement sécurisé via Stripe
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>Réservation directe</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
          isWide && styles.scrollContentWide,
        ]}
      >
        {isWide ? (
          <View style={styles.wideLayout}>
            <View style={styles.wideLeft}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.heroImage} resizeMode="cover" />
              ) : (
                <View style={[styles.heroImage, { backgroundColor: Colors.primarySurface }]} />
              )}
              <View style={styles.listingCard}>
                <Text style={styles.listingName}>{listing.name}</Text>
                {listing.category_name && (
                  <View style={styles.categoryChip}>
                    <Ionicons name="pricetag-outline" size={11} color={Colors.primaryDark} />
                    <Text style={styles.categoryChipText}>{listing.category_name}</Text>
                  </View>
                )}

                <View style={styles.ownerRow}>
                  {ownerAvatar ? (
                    <Image source={{ uri: ownerAvatar }} style={styles.ownerAvatar} />
                  ) : (
                    <View style={styles.ownerAvatarFallback}>
                      <Text style={styles.ownerAvatarInitial}>{ownerName[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.ownerByLabel}>Proposé par</Text>
                    <Text style={styles.ownerName}>{ownerName}</Text>
                  </View>
                </View>

                <View style={styles.datesCard}>
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateBlockLabel}>Début</Text>
                    <Text style={styles.dateBlockValue}>{formatDate(startDate)}</Text>
                  </View>
                  <View style={styles.dateArrow}>
                    <Ionicons name="arrow-forward-outline" size={16} color={Colors.primaryDark} />
                  </View>
                  <View style={[styles.dateBlock, { alignItems: 'flex-end' }]}>
                    <Text style={styles.dateBlockLabel}>Fin</Text>
                    <Text style={styles.dateBlockValue}>{formatDate(endDate)}</Text>
                  </View>
                </View>

                <View style={styles.daysChip}>
                  <Ionicons name="calendar-outline" size={13} color="#fff" />
                  <Text style={styles.daysChipText}>{days} jour{days > 1 ? 's' : ''}</Text>
                </View>
              </View>
            </View>

            <View style={styles.wideRight}>
              {priceSection}
              {ctaSection}
            </View>
          </View>
        ) : (
          <>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.heroImageMobile} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImageMobile, { backgroundColor: Colors.primarySurface }]} />
            )}

            <View style={styles.mobileContent}>
              <Text style={styles.listingName}>{listing.name}</Text>
              {listing.category_name && (
                <View style={styles.categoryChip}>
                  <Ionicons name="pricetag-outline" size={11} color={Colors.primaryDark} />
                  <Text style={styles.categoryChipText}>{listing.category_name}</Text>
                </View>
              )}

              <View style={styles.ownerRow}>
                {ownerAvatar ? (
                  <Image source={{ uri: ownerAvatar }} style={styles.ownerAvatar} />
                ) : (
                  <View style={styles.ownerAvatarFallback}>
                    <Text style={styles.ownerAvatarInitial}>{ownerName[0].toUpperCase()}</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.ownerByLabel}>Proposé par</Text>
                  <Text style={styles.ownerName}>{ownerName}</Text>
                </View>
              </View>

              <View style={styles.datesCard}>
                <View style={styles.dateBlock}>
                  <Text style={styles.dateBlockLabel}>Début</Text>
                  <Text style={styles.dateBlockValue}>{formatDate(startDate)}</Text>
                </View>
                <View style={styles.dateArrow}>
                  <Ionicons name="arrow-forward-outline" size={16} color={Colors.primaryDark} />
                </View>
                <View style={[styles.dateBlock, { alignItems: 'flex-end' }]}>
                  <Text style={styles.dateBlockLabel}>Fin</Text>
                  <Text style={styles.dateBlockValue}>{formatDate(endDate)}</Text>
                </View>
              </View>

              <View style={styles.daysChip}>
                <Ionicons name="calendar-outline" size={13} color="#fff" />
                <Text style={styles.daysChipText}>{days} jour{days > 1 ? 's' : ''}</Text>
              </View>

              {priceSection}
              {ctaSection}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  errorSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  backHomeBtn: {
    marginTop: 8,
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backHomeBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4D8',
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingTop: 16,
  },
  scrollContentWide: {
    paddingHorizontal: 32,
    paddingTop: 32,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  wideLayout: {
    flexDirection: 'row',
    gap: 28,
    alignItems: 'flex-start',
  },
  wideLeft: {
    flex: 1,
    gap: 16,
  },
  wideRight: {
    width: 360,
    flexShrink: 0,
    gap: 16,
  },
  heroImage: {
    width: '100%',
    height: 280,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8E4D8',
    ...Platform.select({
      web: { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
    }),
  },
  heroImageMobile: {
    width: '100%',
    height: 220,
  },
  listingCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E8E4D8',
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
    }),
  },
  mobileContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 14,
  },
  listingName: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primarySurface,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  categoryChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#D4DAC4',
  },
  ownerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    borderWidth: 2,
    borderColor: '#D4DAC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerAvatarInitial: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.primaryDark,
  },
  ownerByLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  ownerName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    letterSpacing: -0.1,
  },
  datesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primarySurface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  dateBlock: {
    gap: 3,
    flex: 1,
  },
  dateBlockLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateBlockValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  dateArrow: {
    paddingHorizontal: 8,
  },
  daysChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDark,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(47,58,47,0.3)' },
    }),
  },
  daysChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  priceCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E8E4D8',
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
    }),
  },
  priceSectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  priceValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  totalLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  totalValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  depositRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primarySurface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D4DAC4',
    marginTop: 4,
  },
  depositText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.primaryDark,
    flex: 1,
    lineHeight: 17,
  },
  ctaSection: {
    gap: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F5C6C6',
  },
  errorBannerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#C25450',
    flex: 1,
    lineHeight: 18,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    height: 54,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 16px rgba(47,58,47,0.4)', cursor: 'pointer' as any },
    }),
  },
  ctaBtnLoading: {
    opacity: 0.7,
  },
  ctaBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#fff',
    letterSpacing: -0.2,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 4,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  loginLinkText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.primaryDark,
    textDecorationLine: 'underline',
  },
  secureNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
