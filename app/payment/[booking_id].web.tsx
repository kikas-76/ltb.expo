import { useState, useEffect, useRef } from 'react';
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
import { ArrowLeft, Lock, ShieldCheck, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const BG = '#F5F0E8';
const GREEN = '#1B4332';
const GREEN_LIGHT = '#ECEEE6';
const GREEN_MID = '#8E9878';

interface BookingData {
  id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  deposit_amount: number;
  listing: {
    name: string;
    photos_url: string[] | null;
    platform_fee_percent: number | null;
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

interface PaymentFormProps {
  rentalClientSecret: string;
  depositClientSecret: string | null;
  depositAmount: number;
  bookingId: string;
  rentalPaymentIntentId: string | null;
  depositPaymentIntentId: string | null;
  totalNow: number;
}

function StripePaymentForm(props: PaymentFormProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret: props.rentalClientSecret, appearance: { theme: 'stripe' } }}
    >
      <PaymentForm {...props} />
    </Elements>
  );
}

function PaymentForm({
  rentalClientSecret,
  depositClientSecret,
  depositAmount,
  bookingId,
  rentalPaymentIntentId,
  depositPaymentIntentId,
  totalNow,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardComplete, setCardComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements || !cardComplete || loading) return;
    setLoading(true);

    try {
      const cardElement = elements.getElement(CardElement);

      const { error: rentalError, paymentIntent: rentalIntent } =
        await stripe.confirmCardPayment(rentalClientSecret, {
          payment_method: { card: cardElement! },
        });
      if (rentalError) throw new Error(rentalError.message);
      if (rentalIntent?.status !== 'succeeded') throw new Error('Paiement location échoué');

      if (depositClientSecret && depositAmount > 0) {
        const { error: depositError, paymentIntent: depositIntent } =
          await stripe.confirmCardPayment(depositClientSecret, {
            payment_method: { card: cardElement! },
          });
        if (depositError) throw new Error(depositError.message);
        if (depositIntent?.status !== 'requires_capture' && depositIntent?.status !== 'succeeded') {
          throw new Error('Autorisation caution échouée');
        }
      }

      await supabase
        .from('bookings')
        .update({
          status: 'active',
          stripe_payment_intent_id: depositPaymentIntentId,
          stripe_transfer_id: rentalPaymentIntentId,
        })
        .eq('id', bookingId);

      router.replace({
        pathname: '/payment-success',
        params: { booking_id: bookingId },
      } as any);
    } catch (err: any) {
      Alert.alert('Erreur paiement', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Carte bancaire</Text>
      <View style={styles.card}>
        <View style={styles.cardElementWrapper}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1B4332',
                  fontFamily: 'Inter, sans-serif',
                  '::placeholder': { color: '#9CA3AF' },
                },
                invalid: { color: '#C0392B' },
              },
              hidePostalCode: true,
            }}
            onChange={(e: any) => setCardComplete(e.complete)}
          />
        </View>
        <View style={styles.securityRow}>
          <ShieldCheck size={13} color={GREEN_MID} strokeWidth={2} />
          <Text style={styles.securityText}>
            Paiement sécurisé par Stripe. Données jamais stockées sur nos serveurs.
          </Text>
        </View>
      </View>

      <View style={styles.payBtnWrapper}>
        <TouchableOpacity
          style={[styles.payBtn, (!cardComplete || loading) && styles.payBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.88}
          disabled={!cardComplete || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Lock size={16} color="#fff" strokeWidth={2.5} />
              <Text style={styles.payBtnText}>Confirmer le paiement</Text>
              <Text style={styles.payBtnAmount}>{totalNow} €</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PaymentScreen() {
  const { booking_id } = useLocalSearchParams<{ booking_id: string }>();
  const insets = useSafeAreaInsets();

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [rentalClientSecret, setRentalClientSecret] = useState<string | null>(null);
  const [depositClientSecret, setDepositClientSecret] = useState<string | null>(null);
  const [rentalPaymentIntentId, setRentalPaymentIntentId] = useState<string | null>(null);
  const [depositPaymentIntentId, setDepositPaymentIntentId] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);

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
            platform_fee_percent
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

  useEffect(() => {
    if (!booking_id || !booking) return;
    (async () => {
      setLoadingIntent(true);
      setIntentError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
            body: JSON.stringify({
              access_token: session?.access_token,
              booking_id,
            }),
          }
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (!data.rental_client_secret) throw new Error('Client secret manquant');
        setRentalClientSecret(data.rental_client_secret);
        setDepositClientSecret(data.deposit_client_secret ?? null);
        setRentalPaymentIntentId(data.rental_payment_intent_id ?? null);
        setDepositPaymentIntentId(data.deposit_payment_intent_id ?? null);
      } catch (err: any) {
        setIntentError(err.message);
      } finally {
        setLoadingIntent(false);
      }
    })();
  }, [booking_id, booking]);

  if (loadingBooking) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#1A1F17" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Réservation introuvable.</Text>
        </View>
      </View>
    );
  }

  const feePercent = 0.07;
  const serviceFee = Math.round(booking.total_price * feePercent * 100) / 100;
  const totalNow = Math.round(booking.total_price * (1 + feePercent) * 100) / 100;
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
          <ArrowLeft size={20} color="#1A1F17" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Lock size={16} color={GREEN} strokeWidth={2.5} />
          <Text style={styles.headerTitle}>Paiement sécurisé</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
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
              <Calendar size={14} color={GREEN_MID} strokeWidth={2} />
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
              <Text style={styles.priceLabelMuted}>Frais de service (7%)</Text>
              <Text style={styles.priceValueMuted}>{serviceFee} €</Text>
            </View>

            <View style={styles.priceRow}>
              <View style={styles.depositLabelRow}>
                <Text style={styles.priceLabelOrange}>Caution (bloquée)</Text>
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

        {loadingIntent && (
          <View style={styles.intentLoadingWrapper}>
            <ActivityIndicator size="small" color={GREEN} />
            <Text style={styles.intentLoadingText}>Préparation du paiement...</Text>
          </View>
        )}

        {intentError && (
          <View style={styles.intentErrorWrapper}>
            <Text style={styles.intentErrorText}>{intentError}</Text>
          </View>
        )}

        {rentalClientSecret && !loadingIntent && (
          <StripePaymentForm
            rentalClientSecret={rentalClientSecret}
            depositClientSecret={depositClientSecret}
            depositAmount={booking.deposit_amount}
            bookingId={booking_id!}
            rentalPaymentIntentId={rentalPaymentIntentId}
            depositPaymentIntentId={depositPaymentIntentId}
            totalNow={totalNow}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#5A5A5A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4D8',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFDF7',
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
    color: '#1A1F17',
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
    color: '#5A5A5A',
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
    borderColor: '#EAE6D8',
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
    }),
  },
  cardElementWrapper: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    minHeight: 48,
    justifyContent: 'center',
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
    borderColor: '#EAE6D8',
    flexShrink: 0,
  },
  listingThumbFallback: {
    backgroundColor: GREEN_LIGHT,
  },
  listingInfo: {
    flex: 1,
    gap: 4,
  },
  listingName: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#1A1F17',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  ownerName: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: GREEN_MID,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: GREEN_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  datesText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#1A1F17',
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
    color: '#1A1F17',
  },
  priceValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#1A1F17',
  },
  priceLabelMuted: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#7A7A7A',
  },
  priceValueMuted: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#7A7A7A',
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
    color: GREEN,
  },
  totalValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: GREEN,
    letterSpacing: -0.3,
  },
  depositNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: '#7A7A7A',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 4,
    marginTop: 2,
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
    color: '#7A7A7A',
    textAlign: 'center',
    flex: 1,
    lineHeight: 16,
  },
  payBtnWrapper: {
    marginTop: 4,
  },
  payBtn: {
    height: 56,
    borderRadius: 999,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Platform.select({
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
  intentLoadingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  intentLoadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#7A7A7A',
  },
  intentErrorWrapper: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  intentErrorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
  },
});
