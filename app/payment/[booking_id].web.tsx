import { useState, useEffect } from 'react';
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
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { translatePaymentError } from '@/lib/paymentErrors';
import { Colors } from '@/constants/colors';

// Singleton: loadStripe must be called once at module scope. Re-creating
// the promise on every render would tear down and rebuild the Stripe
// runtime each time React re-renders the payment screen.
const stripePromise = loadStripe(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');


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
  userEmail: string | null;
}

// Inner form rendered inside <Elements>. Splits cleanly so we can use
// useStripe / useElements (must be a child of Elements). Renders real
// DOM elements so Stripe's runtime can mount the PaymentElement
// directly into the React tree — no wrapping iframe, no srcdoc, no
// `null` origin (the previous srcdoc setup broke hCaptcha's
// postMessage when Stripe ran fraud checks, which silently froze the
// form before it could even submit).
function CheckoutForm({
  bookingId,
  rentalPaymentIntentId,
  totalNow,
  userEmail,
}: {
  bookingId: string;
  rentalPaymentIntentId: string | null;
  totalNow: number;
  userEmail: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!stripe || !elements || loading) return;
    setLoading(true);
    setError(null);

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Stripe requires every billing-details field we set to
          // `never` on the PaymentElement to be passed back at confirm
          // time — otherwise it raises IntegrationError. The email
          // comes from the renter's auth session (we have it: they
          // had to sign in to reach this screen). Falling back to a
          // technically-valid placeholder if the session lookup
          // failed avoids blocking the payment on a missing email.
          payment_method_data: {
            billing_details: {
              name: name.trim() || 'Locataire',
              email: userEmail || 'noreply@louetonbien.fr',
            },
          },
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        throw new Error(stripeError.message ?? 'Erreur paiement');
      }
      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error('Paiement location échoué');
      }

      // Verify + activate booking server-side. Webhook also handles this
      // path idempotently, but the explicit call closes the redirect-
      // less success window that would otherwise leave the user on a
      // spinner waiting for the webhook to arrive.
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
            booking_id: bookingId,
            rental_payment_intent_id: rentalPaymentIntentId ?? paymentIntent.id,
          }),
        },
      );
      const finalizeJson = await finalizeRes.json();
      if (!finalizeRes.ok || finalizeJson.success !== true) {
        throw new Error(
          finalizeJson.error ??
            "Le paiement a été traité mais la réservation n'a pas pu être finalisée. Contacte le support.",
        );
      }

      router.replace(`/payment-success?booking_id=${bookingId}` as any);
    } catch (err) {
      setError(translatePaymentError(err));
      setLoading(false);
    }
  };

  // DOM-only styles — this branch only ever renders on web.
  const labelStyle: any = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#30313D',
    marginBottom: 6,
    letterSpacing: '0.01em',
    fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  };
  const inputStyle: any = {
    width: '100%',
    height: 44,
    borderRadius: 6,
    border: '1.5px solid #E0E0E0',
    padding: '0 12px',
    fontSize: 15,
    color: '#30313D',
    outline: 'none',
    marginBottom: 16,
    background: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    boxSizing: 'border-box',
  };
  const submitStyle: any = {
    width: '100%',
    height: 52,
    borderRadius: 6,
    background: !stripe || !elements || loading ? '#7BA3DC' : '#0570DE',
    color: '#fff',
    border: 'none',
    fontSize: 15,
    fontWeight: 700,
    cursor: !stripe || !elements || loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    letterSpacing: '-0.1px',
    marginTop: 20,
    fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  };
  const secureRow: any = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    color: '#8A8A9A',
    fontSize: 11,
    fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="ltb-cardholder-name" style={labelStyle}>Nom complet</label>
      <input
        id="ltb-cardholder-name"
        type="text"
        placeholder="Prénom et nom"
        autoComplete="cc-name"
        value={name}
        onChange={(e: any) => setName(e.target.value)}
        style={inputStyle}
      />
      <PaymentElement
        options={{
          layout: 'tabs',
          // We collect the cardholder name in our own input above, and
          // we pinned the PaymentIntent to card-only so Link doesn't
          // ask for an email either. Result: the PaymentElement is
          // exactly card / expiry / CVC, no auxiliary fields.
          fields: { billingDetails: { name: 'never', email: 'never' } },
        }}
      />
      <button type="submit" disabled={!stripe || !elements || loading} style={submitStyle}>
        {loading ? (
          <span style={{ display: 'inline-block', width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ltb-spin 0.6s linear infinite' } as any} />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 } as any}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Confirmer le paiement — {totalNow} €
          </span>
        )}
      </button>
      {error && (
        <div style={{ color: '#DF1B41', fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 1.5, fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' } as any}>
          {error}
        </div>
      )}
      <div style={secureRow}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A8A9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Paiement sécurisé par Stripe. Données jamais stockées sur nos serveurs.
      </div>
      <style>{`@keyframes ltb-spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}

function StripeEmbedForm({
  rentalClientSecret,
  bookingId,
  rentalPaymentIntentId,
  totalNow,
  userEmail,
}: StripeEmbedProps) {
  // Memoised options; passing the same shape on every render avoids
  // remounting the underlying Stripe elements on parent re-renders.
  const options = {
    clientSecret: rentalClientSecret,
    locale: 'fr' as const,
    appearance: {
      theme: 'stripe' as const,
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
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Carte bancaire</Text>
      <View style={styles.card}>
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm
            bookingId={bookingId}
            rentalPaymentIntentId={rentalPaymentIntentId}
            totalNow={totalNow}
            userEmail={userEmail}
          />
        </Elements>
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
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Read once at mount; the user can't reach this page without a
    // session, so this almost always returns synchronously.
    supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email ?? null));
  }, []);

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
      } catch (err) {
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
                  La caution de {booking.deposit_amount} € est bloquée mais non débitée, libérée après le retour
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
                userEmail={userEmail}
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
    paddingHorizontal: 48,
    paddingTop: 40,
    paddingBottom: 56,
    maxWidth: 1200,
    alignSelf: 'center' as any,
    width: '100%',
  },
  twoCol: {
    flexDirection: 'column',
    gap: 20,
  },
  twoColDesktop: {
    flexDirection: 'row',
    gap: 40,
    alignItems: 'flex-start',
  },
  colLeft: {},
  // Récap is purely informational — keep it compact so the eye lands on
  // the payment form. flexBasis caps the column at a comfortable width;
  // flexShrink: 1 lets it give way on narrow desktops (1024-1200).
  colLeftDesktop: {
    flexBasis: 380,
    flexShrink: 1,
    flexGrow: 0,
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        top: 24,
      },
    }),
  },
  colRight: {},
  // Payment form gets the remaining horizontal space — it carries the
  // Stripe iframe, the cardholder textbox and the call-to-action. On a
  // 1200-wide canvas this lands ~720px wide, which Stripe likes.
  colRightDesktop: {
    flex: 1,
    minWidth: 0,
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
