import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';


interface BookingData {
  id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  deposit_amount: number;
  listing: {
    name: string;
    photos_url: string[] | null;
    renter_fee_percent: number;
  };
  owner: {
    username: string | null;
  } | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

let CardField: any = null;
let useStripe: (() => any) | null = null;

if (Platform.OS !== 'web') {
  try {
    const stripe = require('@stripe/stripe-react-native');
    CardField = stripe.CardField;
    useStripe = stripe.useStripe;
  } catch {}
}

function useStripeHook() {
  if (useStripe) {
    return useStripe();
  }
  return { confirmPayment: async () => ({ error: { message: 'Stripe non disponible sur web' } }) };
}

export default function PaymentScreen() {
  const { booking_id } = useLocalSearchParams<{ booking_id: string }>();
  const insets = useSafeAreaInsets();
  const stripeHook = useStripeHook();
  const confirmPayment = stripeHook?.confirmPayment;

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [cardComplete, setCardComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!booking_id) return;
    (async () => {
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          listing:listings(
            name,
            photos_url,
            renter_fee_percent
          ),
          owner:profiles!bookings_owner_id_fkey(
            username
          )
        `)
        .eq('id', booking_id)
        .maybeSingle();
      if (data) setBooking(data as BookingData);
      setLoadingBooking(false);
    })();
  }, [booking_id]);

  const handlePayment = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            access_token: session?.access_token,
            booking_id: booking_id,
          }),
        }
      );

      const data = await response.json();

      if (data.error) throw new Error(data.error);
      if (!data.rental_client_secret) {
        throw new Error('Client secret manquant');
      }

      const { error: rentalError } = await confirmPayment(data.rental_client_secret, {
        paymentMethodType: 'Card',
      });
      if (rentalError) throw new Error(rentalError.message);

      // Deposit is NOT charged at payment time — it will be held automatically
      // 2 days before the rental ends via the hold-deposit cron function.

      const finalizeRes = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/finalize-booking-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            booking_id,
            rental_payment_intent_id: data.rental_payment_intent_id ?? null,
          }),
        }
      );
      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok || finalizeJson.success !== true) {
        throw new Error(
          finalizeJson.error ??
          'Le paiement a été traité mais la réservation n\'a pas pu être finalisée. Contacte le support.'
        );
      }

      router.replace({
        pathname: '/payment-success',
        params: { booking_id: booking_id },
      } as any);

    } catch (err: any) {
      Alert.alert('Erreur paiement', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingBooking) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
        </View>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#1A1F17" />
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Réservation introuvable.</Text>
        </View>
      </View>
    );
  }

  const feePercent = (booking.listing?.renter_fee_percent ?? 7) / 100;
  const serviceFee = Math.round(booking.total_price * feePercent * 100) / 100;
  const totalNow = Math.round((booking.total_price + serviceFee) * 100) / 100;
  const thumb = booking.listing?.photos_url?.[0] ?? null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back-outline" size={20} color="#1A1F17" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Ionicons name="lock-closed-outline" size={16} color={Colors.primaryDark} />
          <Text style={styles.headerTitle}>Paiement sécurisé</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Récapitulatif</Text>

          <View style={styles.card}>
            <View style={styles.listingRow}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.listingThumb} />
              ) : (
                <View style={[styles.listingThumb, styles.listingThumbFallback]} />
              )}
              <View style={styles.listingInfo}>
                <Text style={styles.listingName} numberOfLines={2}>
                  {booking.listing?.name}
                </Text>
                {booking.owner?.username && (
                  <Text style={styles.ownerName}>par {booking.owner.username}</Text>
                )}
              </View>
            </View>

            <View style={styles.datesRow}>
              <Ionicons name="calendar-outline" size={14} color={Colors.primaryDark} />
              <Text style={styles.datesText}>
                Du {formatDate(booking.start_date)} au {formatDate(booking.end_date)}
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Location</Text>
              <Text style={styles.priceValue}>{booking.total_price} €</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabelMuted}>Frais de service ({booking.listing?.renter_fee_percent ?? 7}%)</Text>
              <Text style={styles.priceValueMuted}>{serviceFee} €</Text>
            </View>

            <View style={styles.priceRow}>
              <View style={styles.depositLabelRow}>
                <Text style={styles.priceLabelOrange}>Caution (bloquée ⏳)</Text>
              </View>
              <Text style={styles.priceValueOrange}>{booking.deposit_amount} €</Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total débité maintenant</Text>
              <Text style={styles.totalValue}>{totalNow} €</Text>
            </View>

            <Text style={styles.depositNote}>
              La caution de {booking.deposit_amount} € est bloquée mais non débitée — libérée après le retour
            </Text>
          </View>
        </View>

        {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Carte bancaire</Text>
            <View style={styles.card}>
              {CardField ? (
                <CardField
                  postalCodeEnabled={false}
                  style={{ height: 56, marginVertical: 8 }}
                  cardStyle={{
                    backgroundColor: '#FFFFFF',
                    textColor: Colors.primaryDark,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                  onCardChange={(details: any) => setCardComplete(details.complete)}
                />
              ) : null}
              <View style={styles.securityRow}>
                <Ionicons name="shield-checkmark-outline" size={13} color={Colors.primaryDark} />
                <Text style={styles.securityText}>
                  Paiement sécurisé par Stripe. Données jamais stockées sur nos serveurs.
                </Text>
              </View>
            </View>
          </View>
        )}

        {Platform.OS === 'web' && (
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.securityRow}>
                <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primaryDark} />
                <Text style={[styles.securityText, { color: Colors.text, fontSize: 14 }]}>
                  Vous allez être redirigé vers la page de paiement sécurisée Stripe.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.payBtn, loading && styles.payBtnDisabled]}
          onPress={handlePayment}
          activeOpacity={0.88}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={16} color="#fff" />
              <Text style={styles.payBtnText}>
                {Platform.OS === 'web' ? 'Payer maintenant' : 'Confirmer le paiement'}
              </Text>
              <Text style={styles.payBtnAmount}>{totalNow} €</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4D8',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E4D8',
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  headerRight: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
    }),
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  listingThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flexShrink: 0,
  },
  listingThumbFallback: {
    backgroundColor: Colors.primarySurface,
  },
  listingInfo: {
    flex: 1,
    gap: 4,
  },
  listingName: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  ownerName: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primarySurface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  datesText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.text,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#F0ECE4',
    marginVertical: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
  },
  priceValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  priceLabelMuted: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  priceValueMuted: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  depositLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceLabelOrange: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#92400E',
  },
  priceValueOrange: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#92400E',
  },
  totalLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.primaryDark,
  },
  totalValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.primaryDark,
    letterSpacing: -0.3,
  },
  depositNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  webCardNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primarySurface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D4DAC4',
    marginVertical: 8,
  },
  webCardNoticeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 19,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    paddingTop: 4,
  },
  securityText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    flex: 1,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: '#E8E4D8',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 8 },
      web: { boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' },
    }),
  },
  payBtn: {
    height: 56,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 4 },
      web: { boxShadow: '0 4px 16px rgba(27,67,50,0.35)' },
    }),
  },
  payBtnDisabled: {
    opacity: 0.5,
  },
  payBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  payBtnAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
  },
});
