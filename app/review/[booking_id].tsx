import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import RatingStars from '@/components/reviews/RatingStars';
import ReviewModal from '@/components/reviews/ReviewModal';

// Standalone review screen — the target of the email "Donner mon avis"
// CTA and the "Noter" pill on the reservations list. Loads the booking
// + the caller's existing review (if any) and opens the same modal as
// the chat banner. After submission, sends the user back to /reservations.

interface BookingInfo {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  renter_id: string;
  owner_id: string;
  listing: { name: string; photos_url: string[] | null } | null;
  other_username: string | null;
  reviewedSide: 'owner' | 'renter';
}

interface ExistingReview {
  rating: number;
  comment: string | null;
  created_at: string;
}

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const { booking_id } = useLocalSearchParams<{ booking_id: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [existing, setExisting] = useState<ExistingReview | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!user || !booking_id) return;
    (async () => {
      setLoading(true);
      setError(null);

      const { data: b, error: bErr } = await supabase
        .from('bookings')
        .select(`
          id, status, start_date, end_date, renter_id, owner_id,
          listing:listings(name, photos_url),
          renter:profiles!bookings_renter_id_fkey(username),
          owner:profiles!bookings_owner_id_fkey(username)
        `)
        .eq('id', booking_id)
        .maybeSingle();

      if (bErr || !b) {
        setError("Réservation introuvable.");
        setLoading(false);
        return;
      }

      const isRenter = b.renter_id === user.id;
      const isOwner = b.owner_id === user.id;
      if (!isRenter && !isOwner) {
        setError("Tu n'es pas participant de cette location.");
        setLoading(false);
        return;
      }
      if (b.status !== 'completed') {
        setError(
          'La location doit être terminée pour être notée. Reviens une fois le retour validé.',
        );
        setLoading(false);
        return;
      }

      const reviewedSide: 'owner' | 'renter' = isRenter ? 'owner' : 'renter';
      const otherUsername = isRenter
        ? ((b.owner as any)?.username ?? null)
        : ((b.renter as any)?.username ?? null);

      setBooking({
        id: b.id,
        status: b.status,
        start_date: b.start_date,
        end_date: b.end_date,
        renter_id: b.renter_id,
        owner_id: b.owner_id,
        listing: Array.isArray(b.listing) ? (b.listing[0] ?? null) : b.listing,
        other_username: otherUsername,
        reviewedSide,
      });

      const { data: r } = await supabase
        .from('reviews')
        .select('rating, comment, created_at')
        .eq('booking_id', booking_id)
        .eq('reviewer_id', user.id)
        .maybeSingle();
      setExisting(r ?? null);
      setLoading(false);
      setModalOpen(true);
    })();
  }, [user, booking_id]);

  const handleClose = () => {
    setModalOpen(false);
    // Send the user back to the reservations list — the row reflects
    // the new "noted" state via the cached profile/listing aggregates.
    router.replace('/(tabs)/reservations' as any);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Noter cette location</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.errorBtn}
            onPress={() => router.replace('/(tabs)/reservations' as any)}
          >
            <Text style={styles.errorBtnText}>Retour à mes réservations</Text>
          </TouchableOpacity>
        </View>
      ) : booking ? (
        <View style={styles.bookingCard}>
          {booking.listing?.photos_url?.[0] ? (
            <Image source={{ uri: booking.listing.photos_url[0] }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback]}>
              <Ionicons name="cube-outline" size={28} color={Colors.primary} />
            </View>
          )}
          <Text style={styles.bookingName}>{booking.listing?.name ?? 'Location'}</Text>
          <Text style={styles.bookingDates}>
            Du {new Date(booking.start_date).toLocaleDateString('fr-FR')} au{' '}
            {new Date(booking.end_date).toLocaleDateString('fr-FR')}
          </Text>
          <Text style={styles.bookingOther}>
            avec @{booking.other_username ?? (booking.reviewedSide === 'owner' ? 'le propriétaire' : 'le locataire')}
          </Text>

          {existing ? (
            <View style={styles.existingBlock}>
              <Text style={styles.existingLabel}>Ta note actuelle</Text>
              <RatingStars value={existing.rating} readonly size={20} />
              {existing.comment ? (
                <Text style={styles.existingComment} numberOfLines={3}>« {existing.comment} »</Text>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.openBtn}
            activeOpacity={0.85}
            onPress={() => setModalOpen(true)}
          >
            <Ionicons name="star-outline" size={16} color="#fff" />
            <Text style={styles.openBtnText}>
              {existing ? 'Modifier ma note' : 'Donner mon avis'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {booking && (
        <ReviewModal
          visible={modalOpen}
          onClose={handleClose}
          bookingId={booking.id}
          reviewedSide={booking.reviewedSide}
          reviewedUsername={booking.other_username}
          existing={existing}
          onSubmitted={(r) => {
            setExisting({
              rating: r.rating,
              comment: r.comment,
              created_at: existing?.created_at ?? new Date().toISOString(),
            });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, gap: 12,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBtn: {
    marginTop: 8,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 999,
  },
  errorBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  bookingCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    padding: 18,
    margin: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
    }),
  },
  thumb: {
    width: 96, height: 96, borderRadius: 12,
    marginBottom: 8,
  },
  thumbFallback: {
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  bookingName: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  bookingDates: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bookingOther: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.primaryDark,
    marginBottom: 8,
  },
  existingBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  existingLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },
  existingComment: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 4,
  },
  openBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#fff',
  },
});
