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
  KeyboardAvoidingView,
  AppState,
} from 'react-native';
import LoadingBlock from '@/components/LoadingBlock';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getOptimizedImageUrl } from '@/lib/imageUrl';
import { translatePaymentError } from '@/lib/paymentErrors';
import { formatRentalDate } from '@/lib/rentalDates';
import { formatPrice } from '@/lib/pricing';
import { Colors } from '@/constants/colors';
import { haptics } from '@/lib/haptics';
import {
  CardForm,
  PlatformPay,
  PlatformPayButton,
  usePlatformPay,
  useStripe,
} from '@stripe/stripe-react-native';


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

// Jour de location (fin à 23:59:59 UTC) : ne pas afficher le lendemain en France.
const formatDate = (iso: string) => formatRentalDate(iso);

// Doit rester constant : en nouvelle architecture, tout changement de prop recrée
// le formulaire natif et efface la carte déjà saisie.
const CARD_FORM_STYLE = {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  borderColor: Colors.border,
  cursorColor: Colors.primaryDark,
};

export default function PaymentScreen() {
  const { booking_id } = useLocalSearchParams<{ booking_id: string }>();
  const insets = useSafeAreaInsets();
  const { confirmPayment } = useStripe();
  const { isPlatformPaySupported, confirmPlatformPayPayment, openPlatformPaySetup } = usePlatformPay();

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [cardComplete, setCardComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applePayReady, setApplePayReady] = useState(false);

  // Vrai seulement si Wallet contient une carte compatible (Stripe n'ouvre pas la
  // fenêtre Apple Pay sinon). Revérifié au retour dans l'app, après l'ajout
  // d'une carte dans Wallet.
  useEffect(() => {
    const check = () =>
      isPlatformPaySupported()
        .then((supported) => setApplePayReady(supported))
        .catch(() => setApplePayReady(false));
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [isPlatformPaySupported]);

  // Le bouton Apple Pay est toujours affiché sur iPhone ; sans carte dans
  // Wallet, il ouvre Wallet pour en ajouter une.
  const showApplePay = Platform.OS === 'ios' || applePayReady;

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

  // Création du paiement et finalisation, communes à la carte et à Apple Pay.
  const pay = async (
    confirm: (clientSecret: string) => Promise<{ error?: { code?: string; message?: string } }>,
  ) => {
    if (loading) return;
    setError(null);
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

      const { error: rentalError } = await confirm(data.rental_client_secret);
      // Fermer la fenêtre Apple Pay ou 3D Secure n'est pas une erreur à afficher.
      if (rentalError?.code === 'Canceled') return;
      if (rentalError) throw new Error(rentalError.message);

      // Deposit is NOT charged at payment time. It will be held automatically
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
      let finalizeJson = await finalizeRes.json().catch(() => ({}));
      if (!finalizeRes.ok || finalizeJson.success !== true) {
        // Le paiement est encaissé : le webhook Stripe activera la réservation
        // même si cet appel échoue (réseau). On retente une fois, puis on
        // continue vers l'écran de confirmation.
        await new Promise((r) => setTimeout(r, 1500));
        const retry = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/finalize-booking-payment`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ booking_id, rental_payment_intent_id: data.rental_payment_intent_id ?? null }),
          },
        ).catch(() => null);
        finalizeJson = retry ? await retry.json().catch(() => ({})) : {};
        if (finalizeJson.success !== true) console.error('finalize-booking-payment failed after payment:', finalizeJson.error);
      }

      haptics.success();
      router.replace({
        pathname: '/payment-success',
        params: { booking_id: booking_id },
      } as any);

    } catch (err) {
      haptics.error();
      setError(translatePaymentError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCardPayment = () => {
    if (!cardComplete) {
      setError('Renseignez votre carte bancaire pour continuer.');
      haptics.error();
      return;
    }
    pay((clientSecret) => confirmPayment(clientSecret, { paymentMethodType: 'Card' }));
  };

  if (loadingBooking) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <LoadingBlock fill={false} />
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
  const thumb = getOptimizedImageUrl(booking.listing?.photos_url?.[0] ?? null, { width: 160, height: 160, resize: 'cover' });

  const canPay = Platform.OS === 'web' || cardComplete;
  const depositAmount = booking.deposit_amount ?? 0;

  const handleApplePay = () => {
    // La caution est réservée 2 jours avant la fin (tout de suite si la location
    // est courte) : elle figure dans la fenêtre Apple Pay comme montant différé.
    const depositDate = Math.max(new Date(booking.end_date).getTime() - 2 * 86400000, Date.now() + 3600000);
    const immediate = PlatformPay.PaymentType.Immediate as const;
    pay((clientSecret) =>
      confirmPlatformPayPayment(clientSecret, {
        applePay: {
          merchantCountryCode: 'FR',
          currencyCode: 'EUR',
          cartItems: [
            { paymentType: immediate, label: 'Location', amount: booking.total_price.toFixed(2) },
            { paymentType: immediate, label: 'Frais de service', amount: serviceFee.toFixed(2) },
            ...(depositAmount > 0
              ? [{
                  paymentType: PlatformPay.PaymentType.Deferred as const,
                  label: 'Caution (réservée, non débitée)',
                  amount: depositAmount.toFixed(2),
                  deferredDate: Math.floor(depositDate / 1000),
                }]
              : []),
            { paymentType: immediate, label: 'LoueTonBien', amount: totalNow.toFixed(2) },
          ],
        },
      }),
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
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
              <Text style={styles.priceValue}>{formatPrice(booking.total_price)}</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabelMuted}>Frais de service ({booking.listing?.renter_fee_percent ?? 7}%)</Text>
              <Text style={styles.priceValueMuted}>{formatPrice(serviceFee)}</Text>
            </View>

            {depositAmount > 0 && (
              <View style={styles.priceRow}>
                <View style={styles.depositLabelRow}>
                  <Text style={styles.priceLabelOrange}>Caution, non débitée</Text>
                </View>
                <Text style={styles.priceValueOrange}>{formatPrice(depositAmount)}</Text>
              </View>
            )}

            <View style={styles.separator} />

            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total débité maintenant</Text>
              <Text style={styles.totalValue}>{formatPrice(totalNow)}</Text>
            </View>

            {depositAmount > 0 && (
              <Text style={styles.depositNote}>
                La caution de {formatPrice(depositAmount)} n'est pas débitée : elle est réservée sur votre moyen de paiement deux jours avant la fin de la location, puis libérée après le retour.
              </Text>
            )}
          </View>
        </View>

        {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Moyen de paiement</Text>
            <View style={styles.card}>
              {showApplePay && (
                <>
                  <PlatformPayButton
                    type={PlatformPay.ButtonType.Pay}
                    appearance={PlatformPay.ButtonStyle.Black}
                    borderRadius={14}
                    onPress={() => {
                      if (applePayReady) handleApplePay();
                      else openPlatformPaySetup().catch(() => {});
                    }}
                    disabled={loading}
                    style={styles.applePayBtn}
                  />
                  <View style={styles.orRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>ou par carte</Text>
                    <View style={styles.orLine} />
                  </View>
                </>
              )}
              <Text style={styles.cardCaption}>Visa, Mastercard, American Express</Text>
              <CardForm
                style={styles.cardForm}
                cardStyle={CARD_FORM_STYLE}
                onFormComplete={(details) => {
                  setCardComplete(details.complete);
                  if (details.complete) setError(null);
                }}
              />
              {depositAmount > 0 && (
                <Text style={styles.consentText}>
                  En payant, vous autorisez LoueTonBien à réserver la caution de {formatPrice(depositAmount)} sur ce moyen de paiement, sans nouvelle validation de votre part.
                </Text>
              )}
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

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}
        {!canPay && !error && (
          <Text style={styles.payHint}>
            {showApplePay ? 'Payez avec Apple Pay, ou renseignez votre carte.' : 'Renseignez votre carte pour activer le paiement.'}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.payBtn, (loading || !canPay) && styles.payBtnDisabled]}
          onPress={handleCardPayment}
          activeOpacity={0.88}
          disabled={loading || !canPay}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={16} color="#fff" />
              <Text style={styles.payBtnText}>
                {showApplePay ? 'Payer par carte' : 'Confirmer le paiement'}
              </Text>
              <Text style={styles.payBtnAmount}>{formatPrice(totalNow)}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cardCaption: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardForm: {
    height: 270,
  },
  applePayBtn: {
    height: 54,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  orText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  consentText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.error,
  },
  payHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
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
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
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
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
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
