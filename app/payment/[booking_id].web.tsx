import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

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

interface StripeEmbedProps {
  rentalClientSecret: string;
  depositClientSecret: string | null;
  depositAmount: number;
  bookingId: string;
  rentalPaymentIntentId: string | null;
  depositPaymentIntentId: string | null;
  totalNow: number;
}

function StripeEmbedForm({
  rentalClientSecret,
  depositClientSecret,
  depositAmount,
  bookingId,
  rentalPaymentIntentId,
  depositPaymentIntentId,
  totalNow,
}: StripeEmbedProps) {
  const iframeRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://js.stripe.com/v3/"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, -apple-system, sans-serif; background: transparent; padding: 0; }
  #name-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; display: block; }
  #cardholder-name {
    width: 100%; height: 40px; border-radius: 6px;
    border: 1px solid #E0E0E0; padding: 0 12px;
    font-size: 14px; color: #1A1F17; outline: none;
    margin-bottom: 12px;
  }
  #cardholder-name:focus { border-color: #1B4332; box-shadow: 0 0 0 2px rgba(27,67,50,0.12); }
  #card-element {
    border: 1px solid #E0E0E0; border-radius: 6px;
    padding: 10px 12px; margin-bottom: 16px;
    background: #fff;
  }
  #submit {
    width: 100%; height: 52px; border-radius: 999px;
    background: #1B4332; color: #fff; border: none;
    font-size: 16px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    box-shadow: 0 4px 16px rgba(27,67,50,0.35);
  }
  #submit:disabled { opacity: 0.55; cursor: not-allowed; }
  #error-msg { color: #C0392B; font-size: 13px; margin-top: 10px; text-align: center; }
  .secure-row { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:10px; color:#7A7A7A; font-size:11px; }
</style>
</head>
<body>
<form id="payment-form">
  <label id="name-label" for="cardholder-name">Full name</label>
  <input id="cardholder-name" type="text" placeholder="First and last name" autocomplete="cc-name" />
  <div id="card-element"></div>
  <button id="submit" type="submit">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    Confirmer le paiement &nbsp;&nbsp;<span style="opacity:0.75">${totalNow} €</span>
  </button>
  <div id="error-msg"></div>
  <div class="secure-row">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8E9878" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    Paiement sécurisé par Stripe. Données jamais stockées sur nos serveurs.
  </div>
</form>
<script>
(async function() {
  var stripe = Stripe(${JSON.stringify(publishableKey)});
  var elements = stripe.elements();
  var cardElement = elements.create('card', {
    style: {
      base: { fontSize: '14px', color: '#1A1F17', fontFamily: 'Inter, -apple-system, sans-serif', '::placeholder': { color: '#AAAAAA' } },
      invalid: { color: '#C0392B' }
    }
  });
  cardElement.mount('#card-element');

  document.getElementById('payment-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = document.getElementById('submit');
    var errDiv = document.getElementById('error-msg');
    var name = document.getElementById('cardholder-name').value.trim();
    btn.disabled = true;
    errDiv.textContent = '';
    window.parent.postMessage({ type: 'stripe_loading', value: true }, '*');

    try {
      var rentalResult = await stripe.confirmCardPayment(${JSON.stringify(rentalClientSecret)}, {
        payment_method: { card: cardElement, billing_details: { name: name || undefined } },
      });
      if (rentalResult.error) throw new Error(rentalResult.error.message);
      if (rentalResult.paymentIntent.status !== 'succeeded') throw new Error('Paiement location échoué');

      var depositSecret = ${JSON.stringify(depositClientSecret)};
      var depositAmt = ${depositAmount};
      if (depositSecret && depositAmt > 0) {
        var paymentMethodId = rentalResult.paymentIntent.payment_method;
        var pmId = typeof paymentMethodId === 'string' ? paymentMethodId : (paymentMethodId && paymentMethodId.id);
        var depositResult = await stripe.confirmCardPayment(depositSecret, {
          payment_method: pmId,
        });
        if (depositResult.error) throw new Error(depositResult.error.message);
        var ds = depositResult.paymentIntent.status;
        if (ds !== 'requires_capture' && ds !== 'succeeded') throw new Error('Autorisation caution échouée');
      }

      window.parent.postMessage({
        type: 'stripe_success',
        bookingId: ${JSON.stringify(bookingId)},
        rentalPaymentIntentId: ${JSON.stringify(rentalPaymentIntentId)},
        depositPaymentIntentId: ${JSON.stringify(depositPaymentIntentId)},
      }, '*');
    } catch(err) {
      errDiv.textContent = err.message || 'Une erreur est survenue';
      btn.disabled = false;
      window.parent.postMessage({ type: 'stripe_loading', value: false }, '*');
    }
  });
})();
</script>
</body>
</html>`;

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'stripe_loading') {
        setLoading(msg.value);
        setError(null);
      }

      if (msg.type === 'stripe_success') {
        setLoading(true);
        try {
          await supabase
            .from('bookings')
            .update({
              status: 'active',
              stripe_payment_intent_id: msg.depositPaymentIntentId,
              stripe_transfer_id: msg.rentalPaymentIntentId,
            })
            .eq('id', msg.bookingId);

          const { data: { session } } = await supabase.auth.getSession();
          if (msg.depositPaymentIntentId && session?.access_token) {
            await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/manage-deposit`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  action: 'authorize',
                  booking_id: msg.bookingId,
                  payment_intent_id: msg.depositPaymentIntentId,
                }),
              }
            );
          }

          router.replace({
            pathname: '/payment-success',
            params: { booking_id: msg.bookingId },
          } as any);
        } catch (err: any) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Carte bancaire</Text>
      <View style={styles.card}>
        {loading && (
          <View style={styles.iframeOverlay}>
            <ActivityIndicator size="small" color={GREEN} />
            <Text style={styles.intentLoadingText}>Traitement du paiement...</Text>
          </View>
        )}
        <iframe
          ref={iframeRef}
          srcDoc={html}
          style={{
            width: '100%',
            minHeight: 260,
            border: 'none',
            borderRadius: 12,
            background: 'transparent',
          } as any}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
        {error && (
          <View style={styles.intentErrorWrapper}>
            <Text style={styles.intentErrorText}>{error}</Text>
          </View>
        )}
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
  const [stripeAccountError, setStripeAccountError] = useState(false);

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
        if (data.error) {
          if (data.error.includes('destination') || data.error.includes('capabilities')) {
            setStripeAccountError(true);
            return;
          }
          throw new Error(data.error);
        }
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
          <Ionicons name="arrow-back-outline" size={20} color="#1A1F17" />
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
          <Ionicons name="arrow-back-outline" size={20} color="#1A1F17" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Ionicons name="lock-closed-outline" size={16} color={GREEN} />
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
              <Ionicons name="calendar-outline" size={14} color={GREEN_MID} />
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

        {stripeAccountError && (
          <View style={styles.stripeAccountErrorCard}>
            <View style={styles.stripeAccountErrorHeader}>
              <Ionicons name="warning-outline" size={18} color="#721C24" />
              <Text style={styles.stripeAccountErrorTitle}>Paiement impossible</Text>
            </View>
            <Text style={styles.stripeAccountErrorBody}>
              Le loueur n'a pas encore activé son compte de paiement. Contacte-le via la messagerie pour qu'il configure son compte Stripe.
            </Text>
            <TouchableOpacity
              style={styles.stripeAccountErrorBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={15} color="#721C24" />
              <Text style={styles.stripeAccountErrorBtnText}>Contacter le loueur</Text>
            </TouchableOpacity>
          </View>
        )}

        {intentError && !stripeAccountError && (
          <View style={styles.intentErrorWrapper}>
            <Text style={styles.intentErrorText}>{intentError}</Text>
          </View>
        )}

        {rentalClientSecret && !loadingIntent && (
          <StripeEmbedForm
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
  iframeOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
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
  stripeAccountErrorCard: {
    backgroundColor: '#F8D7DA',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 0,
    gap: 10,
  },
  stripeAccountErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stripeAccountErrorTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#721C24',
  },
  stripeAccountErrorBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#721C24',
    lineHeight: 20,
  },
  stripeAccountErrorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#721C24',
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  stripeAccountErrorBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#721C24',
  },
});
