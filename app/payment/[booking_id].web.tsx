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
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { translatePaymentError } from '@/lib/paymentErrors';
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

interface StripeEmbedProps {
  rentalClientSecret: string;
  bookingId: string;
  rentalPaymentIntentId: string | null;
  totalNow: number;
}

function StripeEmbedForm({
  rentalClientSecret,
  bookingId,
  rentalPaymentIntentId,
  totalNow,
}: StripeEmbedProps) {
  const iframeRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const iframeHeight = isDesktop ? 340 : 380;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://js.stripe.com/v3/"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: transparent;
    padding: 0 2px;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #30313D;
    margin-bottom: 6px;
    letter-spacing: 0.01em;
  }
  #cardholder-name {
    width: 100%;
    height: 44px;
    border-radius: 6px;
    border: 1.5px solid #E0E0E0;
    padding: 0 12px;
    font-size: 15px;
    color: #30313D;
    outline: none;
    margin-bottom: 16px;
    transition: border-color 0.15s, box-shadow 0.15s;
    background: #fff;
  }
  #cardholder-name:focus {
    border-color: #0570DE;
    box-shadow: 0 0 0 3px rgba(5,112,222,0.12);
  }
  #cardholder-name::placeholder { color: #A3A3A3; }
  #payment-element {
    margin-bottom: 20px;
  }
  #submit {
    width: 100%;
    height: 52px;
    border-radius: 6px;
    background: #0570DE;
    color: #fff;
    border: none;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    letter-spacing: -0.1px;
    transition: background 0.15s, opacity 0.15s;
  }
  #submit:hover:not(:disabled) { background: #0461C1; }
  #submit:disabled { opacity: 0.55; cursor: not-allowed; }
  #error-msg {
    color: #DF1B41;
    font-size: 13px;
    margin-top: 10px;
    text-align: center;
    line-height: 1.5;
    min-height: 18px;
  }
  .secure-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 12px;
    color: #8A8A9A;
    font-size: 11px;
  }
  .spinner {
    display: none;
    width: 18px; height: 18px;
    border: 2.5px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading .spinner { display: block; }
  .loading .btn-text { display: none; }
</style>
</head>
<body>
<form id="payment-form">
  <label for="cardholder-name">Nom complet</label>
  <input id="cardholder-name" type="text" placeholder="Prénom et nom" autocomplete="cc-name" />
  <div id="payment-element"></div>
  <button id="submit" type="submit">
    <div class="spinner"></div>
    <span class="btn-text">
      <svg style="display:inline;vertical-align:middle;margin-right:7px" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Confirmer le paiement &mdash; ${totalNow}&nbsp;€
    </span>
  </button>
  <div id="error-msg"></div>
  <div class="secure-row">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A8A9A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    Paiement sécurisé par Stripe. Données jamais stockées sur nos serveurs.
  </div>
</form>
<script>
(async function() {
  var stripe = Stripe(${JSON.stringify(publishableKey)});
  var elements = stripe.elements({
    clientSecret: ${JSON.stringify(rentalClientSecret)},
    locale: 'fr',
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0570DE',
        colorBackground: '#ffffff',
        colorText: '#30313D',
        colorDanger: '#DF1B41',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        borderRadius: '6px',
        fontSizeBase: '15px',
      },
    },
  });

  var paymentElement = elements.create('payment', {
    layout: 'tabs',
    fields: { billingDetails: { name: 'never' } },
  });
  paymentElement.mount('#payment-element');

  var form = document.getElementById('payment-form');
  var btn = document.getElementById('submit');
  var errDiv = document.getElementById('error-msg');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var name = document.getElementById('cardholder-name').value.trim();
    btn.disabled = true;
    btn.classList.add('loading');
    errDiv.textContent = '';
    window.parent.postMessage({ type: 'stripe_loading', value: true }, '*');

    try {
      var rentalResult = await stripe.confirmPayment({
        elements: elements,
        confirmParams: {
          payment_method_data: { billing_details: { name: name || '' } },
        },
        redirect: 'if_required',
      });

      if (rentalResult.error) throw new Error(rentalResult.error.message);
      var rentalPI = rentalResult.paymentIntent;
      if (!rentalPI || rentalPI.status !== 'succeeded') throw new Error('Paiement location échoué');

      // Deposit is NOT charged at payment time — held automatically 2 days before rental ends

      window.parent.postMessage({
        type: 'stripe_success',
        bookingId: ${JSON.stringify(bookingId)},
        rentalPaymentIntentId: ${JSON.stringify(rentalPaymentIntentId)},
      }, '*');
    } catch(err) {
      errDiv.textContent = err.message || 'Une erreur est survenue';
      btn.disabled = false;
      btn.classList.remove('loading');
      window.parent.postMessage({ type: 'stripe_loading', value: false }, '*');
    }
  });
})();
</script>
</body>
</html>`;

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages from our own srcdoc iframe (event.source is unforgeable)
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'stripe_loading') {
        setLoading(msg.value);
        setError(null);
      }

      if (msg.type === 'stripe_success') {
        setLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();

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
                booking_id: msg.bookingId,
                rental_payment_intent_id: msg.rentalPaymentIntentId ?? null,
              }),
            }
          );
          const finalizeJson = await finalizeRes.json();
          if (!finalizeRes.ok || finalizeJson.success !== true) {
            throw new Error(
              finalizeJson.error ??
              "Le paiement a été traité mais la réservation n'a pas pu être finalisée. Contacte le support."
            );
          }

          // Deposit is NOT charged at payment time — hold-deposit cron handles it

          router.replace(`/payment-success?booking_id=${msg.bookingId}` as any);
        } catch (err: any) {
          setError(translatePaymentError(err));
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
            <ActivityIndicator size="small" color={Colors.primaryDark} />
            <Text style={styles.intentLoadingText}>Traitement du paiement...</Text>
          </View>
        )}
        <iframe
          ref={iframeRef}
          srcDoc={html}
          style={{
            width: '100%',
            height: iframeHeight,
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
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [rentalClientSecret, setRentalClientSecret] = useState<string | null>(null);
  const [rentalPaymentIntentId, setRentalPaymentIntentId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!booking_id || !booking) return;
    (async () => {
      setLoadingIntent(true);
      setIntentError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Session expirée. Reconnecte-toi pour payer.');
        }
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              access_token: session.access_token,
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
        setRentalPaymentIntentId(data.rental_payment_intent_id ?? null);
      } catch (err: any) {
        setIntentError(translatePaymentError(err));
      } finally {
        setLoadingIntent(false);
      }
    })();
  }, [booking_id, booking]);

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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
          isDesktop && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.twoCol, isDesktop && styles.twoColDesktop]}>
          <View style={[styles.colLeft, isDesktop && styles.colLeftDesktop]}>
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
                  <Text style={styles.priceLabelOrange}>Caution (bloquée)</Text>
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
          </View>

          <View style={[styles.colRight, isDesktop && styles.colRightDesktop]}>
            {loadingIntent && (
              <View style={styles.intentLoadingWrapper}>
                <ActivityIndicator size="small" color={Colors.primaryDark} />
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
                bookingId={booking_id!}
                rentalPaymentIntentId={rentalPaymentIntentId}
                totalNow={totalNow}
              />
            )}
          </View>
        </View>
      </ScrollView>
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
  },
  scrollContentDesktop: {
    paddingHorizontal: 40,
    paddingTop: 32,
    maxWidth: 1100,
    alignSelf: 'center' as any,
    width: '100%',
  },
  twoCol: {
    flexDirection: 'column',
    gap: 20,
  },
  twoColDesktop: {
    flexDirection: 'row',
    gap: 32,
    alignItems: 'flex-start',
  },
  colLeft: {},
  colLeftDesktop: {
    flex: 1,
  },
  colRight: {},
  colRightDesktop: {
    flex: 1,
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
    color: Colors.textSecondary,
  },
  intentErrorWrapper: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
  },
  intentErrorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  stripeAccountErrorCard: {
    backgroundColor: '#F8D7DA',
    borderRadius: 12,
    padding: 16,
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
