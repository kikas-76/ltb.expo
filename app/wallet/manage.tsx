import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { computeOwnerEarnings } from '@/lib/pricing';
import { PAYOUT_INTERVAL_LABEL } from '@/lib/payoutSchedule';
import { Colors } from '@/constants/colors';
import { PRELAUNCH_MODE } from '@/lib/launchConfig';
import PreviewUnavailable from '@/components/PreviewUnavailable';

function formatEur(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateStr(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface Badge {
  label: string;
  bg: string;
  color: string;
}

function getPayoutBadge(status: string): Badge {
  switch (status) {
    case 'paid':
      return { label: 'Viré', bg: Colors.primarySurface, color: '#3B6D11' };
    case 'pending':
      return { label: 'En transit', bg: '#FFF8E1', color: '#92400E' };
    case 'in_transit':
      return { label: 'En cours', bg: '#E8F0FE', color: '#1A56DB' };
    case 'failed':
      return { label: 'Échoué', bg: '#FDF2F2', color: '#C25450' };
    case 'canceled':
      return { label: 'Annulé', bg: '#F0F0F0', color: '#6B6B6B' };
    default:
      return { label: status, bg: '#F0F0F0', color: '#6B6B6B' };
  }
}

function getChargeBadge(status: string): Badge {
  switch (status) {
    case 'paid':
    case 'succeeded':
      return { label: 'Reçu', bg: Colors.primarySurface, color: '#3B6D11' };
    case 'pending':
      return { label: 'En attente', bg: '#FFF8E1', color: '#92400E' };
    case 'reversed':
      return { label: 'Remboursé', bg: '#F0F0F0', color: '#6B6B6B' };
    case 'failed':
      return { label: 'Échoué', bg: '#FDF2F2', color: '#C25450' };
    default:
      return { label: status, bg: '#F0F0F0', color: '#6B6B6B' };
  }
}

function StatusBadge({ badge }: { badge: Badge }) {
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: badge.bg }]}>
      <Text style={[badgeStyles.text, { color: badge.color }]}>{badge.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
});

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={sectionCardStyles.card}>{children}</View>;
}

const sectionCardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
    padding: 20,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } as any,
    }),
  },
});

export default function WalletManageScreen() {
  if (PRELAUNCH_MODE) {
    return (
      <PreviewUnavailable
        title="Portefeuille pas encore disponible"
        description="La gestion du portefeuille Stripe s'ouvrira avec la marketplace."
      />
    );
  }
  return <WalletManageContent />;
}

function WalletManageContent() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Session expirée. Reconnecte-toi pour accéder à ton compte paiement.');
        }
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/get-account-details`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ access_token: session.access_token }),
          }
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: completedBookings } = await supabase
            .from('bookings')
            .select('total_price')
            .eq('owner_id', user.id)
            .eq('status', 'completed');

          const totalFromBookings = (completedBookings ?? []).reduce(
            (sum: number, b: any) => sum + computeOwnerEarnings(b.total_price),
            0
          );

          const stripeAvailable = data.balance?.available ?? 0;
          if (stripeAvailable === 0 && totalFromBookings > 0) {
            data.balance = data.balance ?? {};
            data.balance.available_from_bookings = Math.round(totalFromBookings * 100);
          }
        }

        setAccountData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const account = accountData?.account;
  const bankAccount = account?.external_accounts?.[0] ?? null;
  const balance = accountData?.balance;
  const payouts = accountData?.payouts ?? [];
  const charges = accountData?.payments ?? [];

  const isActive = account?.charges_enabled && account?.payouts_enabled;
  const hasRequirements = account?.requirements?.currently_due?.length > 0;

  const accountBadge: Badge = isActive
    ? { label: 'Actif', bg: Colors.primarySurface, color: '#3B6D11' }
    : { label: 'Action requise', bg: '#FFF8E1', color: '#92400E' };

  const bankBadge: Badge = bankAccount?.status === 'verified' || bankAccount?.status === 'new'
    ? { label: 'Vérifié', bg: Colors.primarySurface, color: '#3B6D11' }
    : { label: 'En attente', bg: '#FFF8E1', color: '#92400E' };

  const stripeAvailable = balance?.available ?? 0;
  const availableFromBookings = balance?.available_from_bookings ?? 0;
  const isEstimated = stripeAvailable === 0 && availableFromBookings > 0;
  const availableBalance = isEstimated ? availableFromBookings : stripeAvailable;
  const pendingBalance = balance?.pending ?? 0;
  const currency = balance?.currency?.toUpperCase() ?? 'EUR';

  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Chargement de ton compte...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="warning-outline" size={48} color="#D97706" />
        <Text style={styles.errorTitle}>Erreur</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace('/wallet')}>
          <Text style={styles.retryBtnText}>Retour au portefeuille</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusSection = (
    <SectionCard>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Statut du compte</Text>
        <StatusBadge badge={accountBadge} />
      </View>

      {hasRequirements && (
        <View style={styles.warningBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#92400E" style={{ flexShrink: 0 }} />
          <View style={{ flex: 1, gap: 10 }}>
            <Text style={styles.warningText}>
              Des informations supplémentaires sont requises par Stripe. Complète ton profil pour continuer à recevoir des paiements.
            </Text>
            <TouchableOpacity
              style={styles.warningBtn}
              onPress={() => router.push({ pathname: '/wallet/onboarding', params: { mode: 'edit' } })}
              activeOpacity={0.82}
            >
              <Text style={styles.warningBtnText}>Mettre à jour</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.infoList}>
        {account?.email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{account.email}</Text>
          </View>
        )}
        {account?.created && (
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoLabel}>Inscrit le</Text>
            <Text style={styles.infoValue}>{formatDate(account.created)}</Text>
          </View>
        )}
        {account?.business_type && (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>
              {account.business_type === 'company' ? 'Entreprise' : 'Particulier'}
            </Text>
          </View>
        )}
      </View>
    </SectionCard>
  );

  const personalSection = (
    <SectionCard>
      <Text style={styles.sectionTitle}>Informations personnelles</Text>
      <View style={{ gap: 12, marginTop: 4 }}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoLabel}>Nom</Text>
          <Text style={[styles.infoValue, styles.infoValueRight]}>
            {account?.individual_name || 'Non renseigné'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoLabel}>Téléphone</Text>
          <Text style={[styles.infoValue, styles.infoValueRight]}>
            {account?.phone || 'Non renseigné'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="flag-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.infoLabel}>Pays</Text>
          <Text style={[styles.infoValue, styles.infoValueRight]}>
            {account?.country === 'FR' ? 'France' : account?.country || '-'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.outlineEditBtn}
        onPress={() => router.push({ pathname: '/wallet/onboarding', params: { mode: 'edit' } })}
        activeOpacity={0.7}
      >
        <Text style={styles.outlineEditBtnText}>Modifier mes informations →</Text>
      </TouchableOpacity>
    </SectionCard>
  );

  const bankSection = (
    <SectionCard>
      <Text style={styles.sectionTitle}>Compte bancaire</Text>
      {bankAccount ? (
        <View style={{ marginTop: 16, gap: 14 }}>
          <View style={styles.bankHeader}>
            <View style={styles.bankIconWrap}>
              <Ionicons name="business-outline" size={22} color={Colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bankName}>{bankAccount.bank_name ?? 'Banque'}</Text>
              <Text style={styles.bankIban}>
                {'•••• •••• •••• '}
                <Text style={styles.bankIbanLast}>{bankAccount.last4}</Text>
              </Text>
            </View>
            <StatusBadge badge={bankBadge} />
          </View>
          {bankAccount.currency && (
            <View style={styles.infoRow}>
              <Ionicons name="cash-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.infoLabel}>Devise</Text>
              <Text style={styles.infoValue}>{bankAccount.currency.toUpperCase()}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.outlineEditBtn}
            onPress={() => router.push({ pathname: '/wallet/onboarding', params: { mode: 'edit' } })}
            activeOpacity={0.7}
          >
            <Text style={styles.outlineEditBtnText}>Modifier mon IBAN →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <Ionicons name="card-outline" size={36} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Aucun compte bancaire ajouté</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push({ pathname: '/wallet/onboarding', params: { mode: 'edit' } })}
            activeOpacity={0.82}
          >
            <Text style={styles.primaryBtnText}>Ajouter un compte bancaire</Text>
          </TouchableOpacity>
        </View>
      )}
    </SectionCard>
  );

  const balanceSection = (
    <SectionCard>
      <Text style={styles.sectionTitle}>Solde</Text>
      <View style={styles.balanceGrid}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceItemLabel}>Disponible</Text>
          <Text style={styles.balanceItemAmount}>{formatEur(availableBalance)}</Text>
          {isEstimated && (
            <Text style={styles.estimatedNote}>(estimé depuis vos locations)</Text>
          )}
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceItem}>
          <Text style={styles.balanceItemLabel}>En transit</Text>
          <Text style={[styles.balanceItemAmount, { color: Colors.textSecondary }]}>
            {formatEur(pendingBalance)}
          </Text>
        </View>
      </View>
      <View style={styles.transferNote}>
        <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.transferNoteText}>
          Les virements sont effectués automatiquement tous les {PAYOUT_INTERVAL_LABEL}
        </Text>
      </View>
    </SectionCard>
  );

  const payoutsSection = (
    <SectionCard>
      <Text style={styles.sectionTitle}>Historique des virements</Text>
      {payouts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="swap-horizontal-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptySubtext}>Aucun virement pour le moment</Text>
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          {payouts.map((payout: any, i: number) => (
            <View key={payout.id}>
              <View style={styles.listRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.listDate}>{formatDate(payout.arrival_date)}</Text>
                  <StatusBadge badge={getPayoutBadge(payout.status)} />
                </View>
                <Text style={styles.listAmount}>{formatEur(payout.amount)}</Text>
              </View>
              {i < payouts.length - 1 && <View style={styles.listDivider} />}
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );

  const chargesSection = (
    <SectionCard>
      <Text style={styles.sectionTitle}>Paiements reçus</Text>
      {charges.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="receipt-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptySubtext}>Aucun paiement reçu</Text>
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          {charges.map((charge: any, i: number) => (
            <View key={charge.id}>
              <View style={styles.listRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.listDate}>{formatDate(charge.created)}</Text>
                  <Text style={styles.listDesc}>
                    {charge.description || 'Location'}
                  </Text>
                  <StatusBadge badge={getChargeBadge(charge.status)} />
                </View>
                <Text style={styles.listAmount}>{formatEur(charge.amount)}</Text>
              </View>
              {i < charges.length - 1 && <View style={styles.listDivider} />}
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );

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
        <Text style={styles.headerTitle}>Mon compte paiement</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          isDesktop ? styles.scrollDesktop : styles.scrollMobile,
          { paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
        style={Platform.OS === 'web' ? ({ overflowY: 'auto' } as any) : undefined}
      >
        {isDesktop ? (
          <View style={styles.desktopGrid}>
            <View style={styles.desktopCol}>
              {statusSection}
              {personalSection}
              {bankSection}
              {balanceSection}
            </View>
            <View style={styles.desktopCol}>
              {payoutsSection}
              {chargesSection}
            </View>
          </View>
        ) : (
          <View style={styles.mobileContent}>
            {statusSection}
            {personalSection}
            {bankSection}
            {balanceSection}
            {payoutsSection}
            {chargesSection}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    ...Platform.select({ web: { minHeight: 0 } as any }),
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySurface,
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  scrollMobile: {
    paddingHorizontal: 16,
    paddingTop: 20,
    flexGrow: 1,
  },
  scrollDesktop: {
    paddingHorizontal: 48,
    paddingTop: 32,
  },
  mobileContent: {
    gap: 16,
  },
  desktopGrid: {
    flexDirection: 'row',
    gap: 24,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  desktopCol: {
    flex: 1,
    gap: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  warningText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
  },
  warningBtn: {
    backgroundColor: '#92400E',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  warningBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  infoList: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    width: 80,
  },
  infoValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  infoValueRight: {
    textAlign: 'right',
    fontSize: 14,
  },
  outlineEditBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9D5C8',
    alignSelf: 'flex-start',
  },
  outlineEditBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#2C2C2C',
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bankIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bankName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
    marginBottom: 3,
  },
  bankIban: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  bankIbanLast: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    letterSpacing: 0,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  emptySubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 0,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  balanceDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },
  balanceItemLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  balanceItemAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  estimatedNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 2,
  },
  transferNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderLight,
  },
  transferNoteText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  listDate: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  listDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  listAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: Colors.text,
    flexShrink: 0,
  },
  listDivider: {
    height: 0.5,
    backgroundColor: Colors.borderLight,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  errorTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 24,
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 32,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
