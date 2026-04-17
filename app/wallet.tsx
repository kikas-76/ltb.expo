import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useResponsive } from '@/hooks/useResponsive';
import { supabase } from '@/lib/supabase';
import { computeOwnerEarnings } from '@/lib/pricing';
import { PAYOUT_INTERVAL_DAYS, PAYOUT_INTERVAL_LABEL } from '@/lib/payoutSchedule';
import { PRELAUNCH_MODE } from '@/lib/launchConfig';
import PreviewUnavailable from '@/components/PreviewUnavailable';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

interface Earnings {
  monthly: number;
  total: number;
  pending: number;
}

interface NextTransfer {
  amount: number;
  daysUntil: number;
  lastTransferAt: string | null;
}

interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: number;
  type: 'income' | 'payment';
  status: string;
  listingName?: string;
}

function formatEur(value: number): string {
  return value.toFixed(2).replace('.', ',') + ' €';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function BalanceCard({ earnings, loading }: { earnings: Earnings; loading: boolean }) {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>Gains totaux</Text>
      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginBottom: 20 }} />
      ) : (
        <Text style={styles.balanceAmount}>{formatEur(earnings.total)}</Text>
      )}
      <View style={styles.balanceDivider} />
      <View style={styles.balanceRow}>
        <View>
          <Text style={styles.balanceSubLabel}>Ce mois</Text>
          <Text style={styles.balanceSubAmount}>
            {loading ? '-' : formatEur(earnings.monthly)}
          </Text>
        </View>
        <View style={styles.balanceRight}>
          <Text style={styles.balanceSubLabel}>En attente</Text>
          <Text style={styles.balanceSubAmount}>
            {loading ? '-' : formatEur(earnings.pending)}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface PaymentStatusCardProps {
  accountComplete: boolean | null;
  loading: boolean;
  onActivate: () => void;
  onManage: () => void;
}

function PaymentStatusCard({
  accountComplete,
  loading,
  onActivate,
  onManage,
}: PaymentStatusCardProps) {
  if (accountComplete) {
    return (
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primary} />
          </View>
          <View style={styles.statusTextWrap}>
            <Text style={styles.statusTitle}>Compte bancaire connecté</Text>
            <Text style={styles.statusSubtitle}>
              Ton compte Stripe est actif. Tu peux recevoir des paiements.
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.outlineBtn}
          activeOpacity={0.82}
          onPress={onManage}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.primaryDark} size="small" />
          ) : (
            <Text style={styles.outlineBtnText}>Mon compte paiement →</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.transferNote}>Virements automatiques tous les {PAYOUT_INTERVAL_LABEL}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <View style={styles.warningIconWrap}>
          <Ionicons name="warning-outline" size={20} color="#D97706" />
        </View>
        <View style={styles.statusTextWrap}>
          <Text style={styles.statusTitle}>Active tes paiements</Text>
          <Text style={styles.statusSubtitle}>
            Connecte ton compte bancaire pour recevoir tes gains. Sécurisé par Stripe.
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.primaryBtn}
        activeOpacity={0.82}
        onPress={onActivate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.primaryBtnText}>Activer mon compte →</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function NextTransferCard({
  accountComplete,
  nextTransfer,
  loading,
}: {
  accountComplete: boolean | null;
  nextTransfer: NextTransfer;
  loading: boolean;
}) {
  const progressPercent = nextTransfer.daysUntil > 0
    ? Math.min(((7 - nextTransfer.daysUntil) / 7) * 100, 100)
    : 100;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Prochain virement</Text>
      {!accountComplete ? (
        <Text style={styles.emptySubtext}>Active ton compte pour recevoir tes virements</Text>
      ) : loading ? (
        <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 12 }} />
      ) : (
        <View>
          <Text style={[styles.nextTransferAmount, { color: Colors.primary }]}>
            {formatEur(nextTransfer.amount)}
          </Text>
          <Text style={styles.emptySubtext}>
            {nextTransfer.daysUntil <= 0
              ? 'Virement en cours de traitement'
              : nextTransfer.daysUntil === 1
              ? 'Estimé demain'
              : `Estimé dans ${nextTransfer.daysUntil} jours`}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>
              {nextTransfer.lastTransferAt
                ? `Dernier : ${formatDate(nextTransfer.lastTransferAt)}`
                : "Aujourd'hui"}
            </Text>
            <Text style={styles.progressLabel}>Dans {PAYOUT_INTERVAL_LABEL}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function TransactionItem({ item, last }: { item: Transaction; last: boolean }) {
  const isIncome = item.type === 'income';
  return (
    <View>
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: isIncome ? '#DCFCE7' : '#F3F4F6' }]}>
          <Text style={{ fontSize: 14 }}>{isIncome ? '↑' : '↓'}</Text>
        </View>
        <View style={styles.txMeta}>
          <Text style={styles.txTitle}>
            {isIncome ? 'Revenu' : 'Paiement'}{item.listingName ? ` · ${item.listingName}` : ''}
          </Text>
          <Text style={styles.txDate}>{item.date}</Text>
          <View style={[styles.txBadge, { backgroundColor: isIncome ? '#DCFCE7' : '#F3F4F6' }]}>
            <Text style={[styles.txBadgeText, { color: isIncome ? Colors.primary : Colors.textSecondary }]}>
              {isIncome ? 'Revenu' : 'Location'}
            </Text>
          </View>
        </View>
        <Text style={[styles.txAmount, { color: isIncome ? Colors.primary : Colors.textSecondary }]}>
          {isIncome ? '+' : '-'}{Math.abs(item.amount).toFixed(2).replace('.', ',')} €
        </Text>
      </View>
      {!last && <View style={styles.txDivider} />}
    </View>
  );
}

function HistorySection({
  transactions,
  loading,
}: {
  transactions: Transaction[];
  loading: boolean;
}) {
  const incomeCount = transactions.filter((t) => t.type === 'income').length;
  const paymentCount = transactions.filter((t) => t.type === 'payment').length;

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>Historique</Text>
      </View>
      {!loading && transactions.length > 0 && (
        <View style={styles.historyTabs}>
          <View style={styles.historyTab}>
            <View style={styles.historyTabDot} />
            <Text style={styles.historyTabText}>{incomeCount} revenu{incomeCount > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.historyTabSep} />
          <View style={[styles.historyTab]}>
            <View style={[styles.historyTabDot, { backgroundColor: Colors.textMuted }]} />
            <Text style={styles.historyTabText}>{paymentCount} paiement{paymentCount > 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator color={Colors.primaryDark} style={{ paddingVertical: 24 }} />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Aucune transaction pour le moment</Text>
            <Text style={styles.emptySubtext}>
              Tes revenus et paiements apparaîtront ici
            </Text>
          </View>
        ) : (
          transactions.map((tx, i) => (
            <TransactionItem key={tx.id} item={tx} last={i === transactions.length - 1} />
          ))
        )}
      </View>
    </View>
  );
}

function InfoCard() {
  const items = [
    'La location est payée à la réservation',
    'Tu reçois 92% du montant total (8% de commission)',
    'Le locataire paie 7% de frais de service en plus du prix affiché',
  ];

  return (
    <View style={styles.infoCard}>
      <View style={styles.infoHeader}>
        <Ionicons name="information-circle-outline" size={17} color={Colors.primaryDark} />
        <Text style={styles.infoTitle}>Comment ça marche ?</Text>
      </View>
      {items.map((item) => (
        <View key={item} style={styles.infoRow}>
          <Ionicons name="checkmark-outline" size={14} color={Colors.primary} />
          <Text style={styles.infoText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function WalletScreen() {
  if (PRELAUNCH_MODE) {
    return (
      <PreviewUnavailable
        title="Portefeuille pas encore disponible"
        description="La configuration du portefeuille et des virements Stripe s'ouvrira avec la marketplace. Tu pourras la faire au lancement, avant tes premières locations."
      />
    );
  }
  return <WalletScreenContent />;
}

function WalletScreenContent() {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  const [accountComplete, setAccountComplete] = useState<boolean | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [earnings, setEarnings] = useState<Earnings>({ monthly: 0, total: 0, pending: 0 });
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [nextTransfer, setNextTransfer] = useState<NextTransfer>({
    amount: 0,
    daysUntil: 7,
    lastTransferAt: null,
  });
  const [nextTransferLoading, setNextTransferLoading] = useState(true);

  const getValidToken = async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session.access_token;

      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        return refreshed?.session?.access_token || null;
      }

      return null;
    } catch {
      return null;
    }
  };

  const checkAccountStatus = async (accessToken: string) => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/check-account-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      setAccountComplete(data.complete === true);
    } catch {
      setAccountComplete(false);
    }
  };

  const loadEarnings = async () => {
    setEarningsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [{ data: monthlyBookings }, { data: totalBookings }, { data: pendingBookings }] =
        await Promise.all([
          supabase
            .from('bookings')
            .select('total_price')
            .eq('owner_id', user.id)
            .eq('status', 'completed')
            .gte('created_at', firstDayOfMonth),
          supabase
            .from('bookings')
            .select('id, total_price, created_at')
            .eq('owner_id', user.id)
            .eq('status', 'completed'),
          supabase
            .from('bookings')
            .select('total_price')
            .eq('owner_id', user.id)
            .eq('status', 'active'),
        ]);

      const calcNet = (bookings: any[]) =>
        (bookings || []).reduce((sum: number, b: any) => sum + computeOwnerEarnings(b.total_price), 0);

      setEarnings({
        monthly: calcNet(monthlyBookings ?? []),
        total: calcNet(totalBookings ?? []),
        pending: calcNet(pendingBookings ?? []),
      });
    } catch {
    } finally {
      setEarningsLoading(false);
    }
  };

  const loadNextTransfer = async () => {
    setNextTransferLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: pendingBookings } = await supabase
        .from('bookings')
        .select('total_price, return_confirmed_at, stripe_rental_payment_intent_id')
        .eq('owner_id', user.id)
        .in('status', ['completed', 'active'])
        .is('stripe_rental_payment_intent_id', null);

      const { data: lastTransferBooking } = await supabase
        .from('bookings')
        .select('return_confirmed_at')
        .eq('owner_id', user.id)
        .eq('status', 'completed')
        .not('stripe_rental_payment_intent_id', 'is', null)
        .order('return_confirmed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const pendingAmount = (pendingBookings ?? []).reduce(
        (sum: number, b: any) => sum + computeOwnerEarnings(b.total_price),
        0
      );

      const lastTransferAt = lastTransferBooking?.return_confirmed_at ?? null;

      let daysUntil = PAYOUT_INTERVAL_DAYS;
      if (lastTransferAt) {
        const daysSinceLast = Math.floor(
          (Date.now() - new Date(lastTransferAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        daysUntil = Math.max(0, PAYOUT_INTERVAL_DAYS - daysSinceLast);
      }

      setNextTransfer({ amount: pendingAmount, daysUntil, lastTransferAt });
    } catch {
    } finally {
      setNextTransferLoading(false);
    }
  };

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: ownerBookings }, { data: renterBookings }] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, total_price, created_at, status, listing_id, listings(name)')
          .eq('owner_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('id, total_price, created_at, status, listing_id, listings(name)')
          .eq('renter_id', user.id)
          .in('status', ['active', 'in_progress', 'completed'])
          .order('created_at', { ascending: false }),
      ]);

      const incomeTx: Transaction[] = (ownerBookings ?? []).map((b: any) => ({
        id: `income-${b.id}`,
        title: 'Revenu',
        date: formatDate(b.created_at),
        amount: Number(b.total_price) * 0.92,
        type: 'income' as const,
        status: b.status,
        listingName: b.listings?.name,
      }));

      const paymentTx: Transaction[] = (renterBookings ?? []).map((b: any) => ({
        id: `payment-${b.id}`,
        title: 'Paiement',
        date: formatDate(b.created_at),
        amount: Number(b.total_price),
        type: 'payment' as const,
        status: b.status,
        listingName: b.listings?.name,
      }));

      const merged = [...incomeTx, ...paymentTx].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setTransactions(merged);
    } catch {
    } finally {
      setTxLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const initWallet = async () => {
        const token = await getValidToken();

        if (!token) {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            (async () => {
              if (session?.access_token) {
                await checkAccountStatus(session.access_token);
                await Promise.all([loadEarnings(), loadNextTransfer(), loadTransactions()]);
                subscription.unsubscribe();
              }
            })();
          });
          return;
        }

        await checkAccountStatus(token);
        await Promise.all([loadEarnings(), loadNextTransfer(), loadTransactions()]);
      };

      initWallet();
    }, [])
  );

  const activateStripeAccount = async () => {
    if (Platform.OS === 'web') {
      router.push('/wallet/onboarding');
    } else {
      setActivateLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          Alert.alert('Erreur', 'Reconnecte-toi');
          router.push('/login');
          setActivateLoading(false);
          return;
        }

        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-connect-account`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        const data = await response.json();
        if (!data.url) throw new Error(data.error || 'URL manquante');

        const result = await WebBrowser.openAuthSessionAsync(data.url, 'louetonbien://wallet/success');
        if (result.type === 'success' || result.type === 'dismiss') {
          const freshToken = await getValidToken();
          if (freshToken) await checkAccountStatus(freshToken);
        }
      } catch (err: any) {
        Alert.alert('Erreur', err?.message ?? 'Une erreur est survenue');
      } finally {
        setActivateLoading(false);
      }
    }
  };

  const openAccountManagement = () => {
    router.push('/wallet/manage');
  };

  const leftContent = (
    <>
      <BalanceCard earnings={earnings} loading={earningsLoading} />
      <PaymentStatusCard
        accountComplete={accountComplete}
        loading={accountComplete ? manageLoading : activateLoading}
        onActivate={activateStripeAccount}
        onManage={openAccountManagement}
      />
      <NextTransferCard
        accountComplete={accountComplete}
        nextTransfer={nextTransfer}
        loading={nextTransferLoading}
      />
    </>
  );

  const rightContent = (
    <>
      <HistorySection transactions={transactions} loading={txLoading} />
      <InfoCard />
    </>
  );

  if (isDesktop && Platform.OS === 'web') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(tabs)/profil')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mon Portefeuille</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={[walletDesktopStyles.scroll, { paddingBottom: insets.bottom + 48 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={walletDesktopStyles.container}>
            <View style={walletDesktopStyles.leftCol}>{leftContent}</View>
            <View style={walletDesktopStyles.rightCol}>{rightContent}</View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(tabs)/profil')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Portefeuille</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {leftContent}
        {rightContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  balanceCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 16px rgba(27,67,50,0.3)' },
    }),
  },
  balanceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 20,
  },
  balanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceRight: {
    alignItems: 'flex-end',
  },
  balanceSubLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 4,
  },
  balanceSubAmount: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
    }),
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  warningIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  successIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
    marginBottom: 4,
  },
  statusSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  primaryBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    borderRadius: 999,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.primaryDark,
    letterSpacing: 0.2,
  },
  transferNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  cardTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
  },
  nextTransferAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    marginTop: 8,
    marginBottom: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 999,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  historyTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
    gap: 8,
  },
  historyTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyTabDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  historyTabSep: {
    width: 1,
    height: 12,
    backgroundColor: Colors.borderLight,
  },
  historyTabText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txMeta: {
    flex: 1,
    gap: 3,
  },
  txTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  txDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  txBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 2,
  },
  txBadgeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  txAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
  },
  txDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  infoCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 18,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  infoTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 19,
  },
});

const walletDesktopStyles = StyleSheet.create({
  scroll: {
    paddingTop: 32,
    paddingHorizontal: 48,
    gap: 24,
  },
  container: {
    flexDirection: 'row',
    gap: 24,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  leftCol: {
    flex: 1,
    gap: 16,
  },
  rightCol: {
    width: 420,
    gap: 16,
  },
});
