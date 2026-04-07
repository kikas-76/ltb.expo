import { useState, useEffect, useCallback } from 'react';
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
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useResponsive } from '@/hooks/useResponsive';
import { supabase } from '@/lib/supabase';

const DARK_GREEN = Colors.primaryDark;
const LIGHT_BEIGE = '#F5F0E8';
const DARKER_BEIGE = '#EDE8DC';
const SUCCESS_GREEN = Colors.primary;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

interface Earnings {
  monthly: number;
  total: number;
  pending: number;
}

interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: number;
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
            {loading ? '—' : formatEur(earnings.monthly)}
          </Text>
        </View>
        <View style={styles.balanceRight}>
          <Text style={styles.balanceSubLabel}>En attente</Text>
          <Text style={styles.balanceSubAmount}>
            {loading ? '—' : formatEur(earnings.pending)}
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
            <Ionicons name="checkmark-circle-outline" size={20} color={SUCCESS_GREEN} />
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
            <ActivityIndicator color={DARK_GREEN} size="small" />
          ) : (
            <Text style={styles.outlineBtnText}>Gérer mon compte Stripe →</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.transferNote}>Virements automatiques tous les 7 jours</Text>
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

function NextTransferCard({ accountComplete }: { accountComplete: boolean | null }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Prochain virement</Text>
      {!accountComplete ? (
        <Text style={styles.emptySubtext}>Active ton compte pour recevoir tes virements</Text>
      ) : (
        <View>
          <Text style={[styles.cardTitle, { color: SUCCESS_GREEN, fontSize: 22, marginTop: 8 }]}>
            0,00 €
          </Text>
          <Text style={styles.emptySubtext}>Estimé dans 4 jours</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '43%' }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Aujourd'hui</Text>
            <Text style={styles.progressLabel}>Dans 7 jours</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function TransactionItem({ item, last }: { item: Transaction; last: boolean }) {
  const isPositive = item.amount >= 0;
  return (
    <View>
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: isPositive ? '#DCFCE7' : '#FEE2E2' }]}>
          <Text style={{ fontSize: 14 }}>{isPositive ? '↑' : '↓'}</Text>
        </View>
        <View style={styles.txMeta}>
          <Text style={styles.txTitle}>{item.title}</Text>
          <Text style={styles.txDate}>{item.date}</Text>
        </View>
        <Text style={[styles.txAmount, { color: isPositive ? SUCCESS_GREEN : Colors.error }]}>
          {isPositive ? '+' : ''}{item.amount.toFixed(2).replace('.', ',')} €
        </Text>
      </View>
      {!last && <View style={styles.txDivider} />}
    </View>
  );
}

function HistorySection({ transactions }: { transactions: Transaction[] }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>Historique</Text>
      </View>
      <View style={styles.card}>
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Aucune transaction pour le moment</Text>
            <Text style={styles.emptySubtext}>
              Tes gains apparaîtront ici après ta première location
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
        <Ionicons name="information-circle-outline" size={17} color={DARK_GREEN} />
        <Text style={styles.infoTitle}>Comment ça marche ?</Text>
      </View>
      {items.map((item) => (
        <View key={item} style={styles.infoRow}>
          <Ionicons name="checkmark-outline" size={14} color={SUCCESS_GREEN} />
          <Text style={styles.infoText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  const [accountComplete, setAccountComplete] = useState<boolean | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [earnings, setEarnings] = useState<Earnings>({ monthly: 0, total: 0, pending: 0 });
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        body: JSON.stringify({ access_token: accessToken }),
      });
      const data = await response.json();
      console.log('check-account-status:', data);
      setAccountComplete(data.complete === true);
    } catch (err) {
      console.error('Erreur check-account-status:', err);
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
        (bookings || []).reduce((sum: number, b: any) => sum + Number(b.total_price) * 0.92, 0);

      setEarnings({
        monthly: calcNet(monthlyBookings ?? []),
        total: calcNet(totalBookings ?? []),
        pending: calcNet(pendingBookings ?? []),
      });

      const txList: Transaction[] = (totalBookings ?? []).map((b: any) => ({
        id: b.id ?? Math.random().toString(),
        title: 'Location',
        date: formatDate(b.created_at),
        amount: Number(b.total_price) * 0.92,
      }));
      setTransactions(txList.reverse());
    } catch {
    } finally {
      setEarningsLoading(false);
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
                await loadEarnings();
                subscription.unsubscribe();
              }
            })();
          });
          return;
        }

        await checkAccountStatus(token);
        await loadEarnings();
      };

      initWallet();
    }, [])
  );

  const activateStripeAccount = async () => {
    setActivateLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        Alert.alert('Erreur', 'Reconnecte-toi');
        router.push('/login');
        setActivateLoading(false);
        return;
      }

      console.log('Token transmis:', session.access_token.substring(0, 30));

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-connect-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
          body: JSON.stringify({ access_token: session.access_token }),
        },
      );

      const responseText = await response.text();
      console.log('Réponse:', responseText);

      const data = JSON.parse(responseText);
      if (!data.url) throw new Error(data.error || 'URL manquante');

      if (Platform.OS === 'web') {
        window.location.href = data.url;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(data.url, 'louetonbien://wallet/success');
        if (result.type === 'success' || result.type === 'dismiss') {
          const freshToken = await getValidToken();
          if (freshToken) await checkAccountStatus(freshToken);
        }
        setActivateLoading(false);
      }
    } catch (err: any) {
      console.error('Erreur:', err);
      Alert.alert('Erreur', err?.message ?? 'Une erreur est survenue');
      setActivateLoading(false);
    }
  };

  const openStripeDashboard = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        Alert.alert('Erreur', 'Reconnecte-toi')
        return
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-dashboard-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
          body: JSON.stringify({
            access_token: session.access_token
          }),
        }
      )

      const data = await response.json()
      console.log('get-dashboard-link:', data)

      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        Alert.alert('Erreur', data.error || 'URL manquante')
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message)
    }
  };

  const leftContent = (
    <>
      <BalanceCard earnings={earnings} loading={earningsLoading} />
      <PaymentStatusCard
        accountComplete={accountComplete}
        loading={accountComplete ? manageLoading : activateLoading}
        onActivate={activateStripeAccount}
        onManage={openStripeDashboard}
      />
      <NextTransferCard accountComplete={accountComplete} />
    </>
  );

  const rightContent = (
    <>
      <HistorySection transactions={transactions} />
      <InfoCard />
    </>
  );

  if (isDesktop && Platform.OS === 'web') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
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
          onPress={() => router.back()}
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
    backgroundColor: LIGHT_BEIGE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: LIGHT_BEIGE,
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
    backgroundColor: DARK_GREEN,
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: DARK_GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
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
    backgroundColor: DARK_GREEN,
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
    borderColor: DARK_GREEN,
    borderRadius: 999,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: DARK_GREEN,
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
    backgroundColor: SUCCESS_GREEN,
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
    marginBottom: 10,
    paddingHorizontal: 2,
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
  },
  txTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 3,
  },
  txDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
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
    backgroundColor: DARKER_BEIGE,
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
