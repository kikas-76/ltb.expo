import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

interface MonthStat {
  month: string;
  bookings: number;
  revenue: number;
  disputes: number;
}

interface TopListing {
  id: string;
  name: string;
  bookingCount: number;
  revenue: number;
}

interface TopUser {
  id: string;
  username: string | null;
  bookingCount: number;
  totalAmount: number;
}

interface PlatformRevenueBucket {
  renter_fee: number;
  owner_commission: number;
  total: number;
  bookings_count: number;
  gross_rental: number;
}

interface AnalyticsData {
  monthlyRevenue: number;
  monthlyNewUsers: number;
  disputeRate: number;
  restrictedAccounts: number;
  monthlyStats: MonthStat[];
  topListings: TopListing[];
  topRenters: TopUser[];
  topOwners: TopUser[];
  openReports: number;
  openDisputes: number;
  resolvedDisputes: number;
  platformRevenueAllTime: PlatformRevenueBucket;
  platformRevenueThisMonth: PlatformRevenueBucket;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function downloadCSV(csvContent: string, filename: string) {
  if (Platform.OS !== 'web') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

    const [
      { data: monthBookings },
      { count: newUsers },
      { data: restrictedAccountsRaw },
      { data: allMonthlyBookings },
      { data: allMonthlyDisputes },
      { data: listingBookings },
      { data: renterBookings },
      { data: ownerBookings },
      { count: openReports },
      { count: openDisputes },
      { count: resolvedDisputes },
      { data: platformRevenue },
    ] = await Promise.all([
      supabase
        .from('bookings')
        .select('total_price, status')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart),
      // account_status is restricted at the column level for authenticated;
      // counting via direct SELECT silently returns 0. Use the SECURITY
      // DEFINER RPC instead.
      supabase.rpc('admin_count_restricted_accounts'),
      supabase
        .from('bookings')
        .select('created_at, total_price, status')
        .gte('created_at', sixMonthsAgo),
      supabase
        .from('disputes')
        .select('created_at')
        .gte('created_at', sixMonthsAgo),
      supabase
        .from('bookings')
        .select('listing_id, total_price, listing:listings(name)')
        .eq('status', 'completed'),
      supabase
        .from('bookings')
        .select('renter_id, total_price, renter:profiles!bookings_renter_id_fkey(username)')
        .eq('status', 'completed'),
      supabase
        .from('bookings')
        .select('owner_id, total_price, owner:profiles!bookings_owner_id_fkey(username)')
        .eq('status', 'completed'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      // Notre cut = sum(rental × (renter_fee_percent + owner_commission_percent) / 100)
      // calculé serveur via RPC admin-only sur les bookings dont le PI loyer
      // a été capturé (status >= active).
      supabase.rpc('admin_platform_revenue_summary'),
    ]);

    const completedMonthBookings = (monthBookings ?? []).filter((b: any) => b.status === 'completed');
    const monthlyRevenue = completedMonthBookings.reduce((s: number, b: any) => s + (b.total_price ?? 0), 0);
    const disputeRate = (monthBookings ?? []).length > 0
      ? Math.round(((allMonthlyDisputes ?? []).filter((d: any) => {
          const m = new Date(d.created_at);
          return m >= new Date(monthStart) && m <= new Date(monthEnd);
        }).length / (monthBookings ?? []).length) * 100)
      : 0;

    const monthlyStats: MonthStat[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const mBookings = (allMonthlyBookings ?? []).filter((b: any) => {
        const d = new Date(b.created_at);
        return d >= mStart && d <= mEnd;
      });
      const mDisputes = (allMonthlyDisputes ?? []).filter((d: any) => {
        const dt = new Date(d.created_at);
        return dt >= mStart && dt <= mEnd;
      });
      monthlyStats.push({
        month: formatMonth(mStart),
        bookings: mBookings.length,
        revenue: mBookings.filter((b: any) => b.status === 'completed').reduce((s: number, b: any) => s + (b.total_price ?? 0), 0),
        disputes: mDisputes.length,
      });
    }

    const listingMap: Record<string, { name: string; count: number; revenue: number }> = {};
    (listingBookings ?? []).forEach((b: any) => {
      const lid = b.listing_id;
      if (!listingMap[lid]) listingMap[lid] = { name: b.listing?.name ?? '-', count: 0, revenue: 0 };
      listingMap[lid].count++;
      listingMap[lid].revenue += b.total_price ?? 0;
    });
    const topListings: TopListing[] = Object.entries(listingMap)
      .map(([id, v]) => ({ id, name: v.name, bookingCount: v.count, revenue: v.revenue }))
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 5);

    const renterMap: Record<string, { username: string | null; count: number; total: number }> = {};
    (renterBookings ?? []).forEach((b: any) => {
      const uid = b.renter_id;
      if (!renterMap[uid]) renterMap[uid] = { username: b.renter?.username ?? null, count: 0, total: 0 };
      renterMap[uid].count++;
      renterMap[uid].total += b.total_price ?? 0;
    });
    const topRenters: TopUser[] = Object.entries(renterMap)
      .map(([id, v]) => ({ id, username: v.username, bookingCount: v.count, totalAmount: v.total }))
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 5);

    const ownerMap: Record<string, { username: string | null; count: number; total: number }> = {};
    (ownerBookings ?? []).forEach((b: any) => {
      const uid = b.owner_id;
      if (!ownerMap[uid]) ownerMap[uid] = { username: b.owner?.username ?? null, count: 0, total: 0 };
      ownerMap[uid].count++;
      ownerMap[uid].total += b.total_price ?? 0;
    });
    const topOwners: TopUser[] = Object.entries(ownerMap)
      .map(([id, v]) => ({ id, username: v.username, bookingCount: v.count, totalAmount: v.total }))
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 5);

    const emptyBucket: PlatformRevenueBucket = {
      renter_fee: 0, owner_commission: 0, total: 0, bookings_count: 0, gross_rental: 0,
    };
    const platformRevenueAllTime: PlatformRevenueBucket =
      (platformRevenue as any)?.all_time ?? emptyBucket;
    const platformRevenueThisMonth: PlatformRevenueBucket =
      (platformRevenue as any)?.this_month ?? emptyBucket;

    setData({
      monthlyRevenue,
      monthlyNewUsers: newUsers ?? 0,
      disputeRate,
      restrictedAccounts: Number(restrictedAccountsRaw ?? 0),
      monthlyStats,
      topListings,
      topRenters,
      topOwners,
      openReports: openReports ?? 0,
      openDisputes: openDisputes ?? 0,
      resolvedDisputes: resolvedDisputes ?? 0,
      platformRevenueAllTime,
      platformRevenueThisMonth,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    if (Platform.OS !== 'web') return;
    setExportLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const [
      { data: bookingsExport },
      { data: disputesExport },
      { data: reportsExport },
    ] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, status, total_price, deposit_amount, start_date, end_date, created_at, listing:listings(name), renter:profiles!bookings_renter_id_fkey(username), owner:profiles!bookings_owner_id_fkey(username)')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .order('created_at', { ascending: false }),
      // disputes_reporter_id_fkey / reports_reporter_id_fkey both target
      // auth.users — `profiles!fkey(...)` doesn't resolve. Pull bare
      // rows with reporter_id, hydrate usernames in one batch SELECT
      // below.
      supabase
        .from('disputes')
        .select('id, status, description, created_at, reporter_id')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .order('created_at', { ascending: false }),
      supabase
        .from('reports')
        .select('id, status, category, description, target_type, created_at, reporter_id')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .order('created_at', { ascending: false }),
    ]);

    const reporterIds = Array.from(new Set([
      ...((disputesExport ?? []) as Array<{ reporter_id: string | null }>).map((r) => r.reporter_id),
      ...((reportsExport ?? []) as Array<{ reporter_id: string | null }>).map((r) => r.reporter_id),
    ].filter((x): x is string => !!x)));

    const usernameByReporter = new Map<string, string | null>();
    if (reporterIds.length > 0) {
      const { data: reporterProfiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', reporterIds);
      for (const p of (reporterProfiles ?? []) as Array<{ id: string; username: string | null }>) {
        usernameByReporter.set(p.id, p.username ?? null);
      }
    }

    const monthLabel = now.toLocaleDateString('fr-FR', { month: '2-digit', year: 'numeric' }).replace('/', '-');

    const bookingsCsv = [
      'ID,Statut,Annonce,Locataire,Propriétaire,Montant,Dépôt,Début,Fin,Créé le',
      ...(bookingsExport ?? []).map((b: any) =>
        [
          b.id,
          b.status,
          `"${b.listing?.name ?? ''}"`,
          b.renter?.username ?? '',
          b.owner?.username ?? '',
          b.total_price,
          b.deposit_amount ?? '',
          new Date(b.start_date).toLocaleDateString('fr-FR'),
          new Date(b.end_date).toLocaleDateString('fr-FR'),
          new Date(b.created_at).toLocaleDateString('fr-FR'),
        ].join(',')
      ),
    ].join('\n');

    const disputesCsv = [
      'ID,Statut,Signalé par,Description,Créé le',
      ...(disputesExport ?? []).map((d: any) =>
        [
          d.id,
          d.status,
          usernameByReporter.get(d.reporter_id) ?? '',
          `"${(d.description ?? '').replace(/"/g, '""')}"`,
          new Date(d.created_at).toLocaleDateString('fr-FR'),
        ].join(',')
      ),
    ].join('\n');

    const reportsCsv = [
      'ID,Statut,Catégorie,Type cible,Signalé par,Description,Créé le',
      ...(reportsExport ?? []).map((r: any) =>
        [
          r.id,
          r.status,
          r.category ?? '',
          r.target_type,
          usernameByReporter.get(r.reporter_id) ?? '',
          `"${(r.description ?? '').replace(/"/g, '""')}"`,
          new Date(r.created_at).toLocaleDateString('fr-FR'),
        ].join(',')
      ),
    ].join('\n');

    downloadCSV(bookingsCsv, `transactions_${monthLabel}.csv`);
    setTimeout(() => downloadCSV(disputesCsv, `litiges_${monthLabel}.csv`), 300);
    setTimeout(() => downloadCSV(reportsCsv, `signalements_${monthLabel}.csv`), 600);

    setExportLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
      </View>
    );
  }

  const platformMonth = data?.platformRevenueThisMonth;
  const platformAllTime = data?.platformRevenueAllTime;

  const kpis = [
    {
      label: 'Notre commission ce mois',
      value: `${(platformMonth?.total ?? 0).toFixed(2)}€`,
      icon: 'wallet-outline',
      color: Colors.primaryDark,
    },
    { label: 'Volume loyers ce mois', value: `${data?.monthlyRevenue.toFixed(0) ?? 0}€`, icon: 'cash-outline', color: Colors.successGreen },
    { label: 'Nouvelles inscriptions', value: String(data?.monthlyNewUsers ?? 0), icon: 'person-add-outline', color: Colors.info },
    { label: 'Taux de litiges', value: `${data?.disputeRate ?? 0}%`, icon: 'warning-outline', color: Colors.error },
    { label: 'Comptes restreints', value: String(data?.restrictedAccounts ?? 0), icon: 'ban-outline', color: Colors.banned },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Analyses</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* KPIs */}
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + '18' }]}>
                <Ionicons name={k.icon as any} size={20} color={k.color} />
              </View>
              <Text style={styles.kpiValue}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Revenus plateforme : ce qui finit dans notre poche, connecté
            via le application_fee posé sur les PaymentIntents Stripe. */}
        <Text style={styles.sectionTitle}>Revenus plateforme</Text>
        <View style={styles.card}>
          <View style={styles.revenueHeaderRow}>
            <View style={styles.revenueHeaderLeft}>
              <View style={[styles.kpiIcon, { backgroundColor: Colors.primaryDark + '18' }]}>
                <Ionicons name="wallet-outline" size={22} color={Colors.primaryDark} />
              </View>
              <View>
                <Text style={styles.revenueLabel}>Total all-time</Text>
                <Text style={styles.revenueValue}>{(platformAllTime?.total ?? 0).toFixed(2)}€</Text>
                <Text style={styles.revenueSub}>
                  {platformAllTime?.bookings_count ?? 0} location{(platformAllTime?.bookings_count ?? 0) > 1 ? 's' : ''} · volume {Number(platformAllTime?.gross_rental ?? 0).toFixed(2)}€
                </Text>
              </View>
            </View>
            <View style={styles.revenueHeaderRight}>
              <Text style={styles.revenueLabel}>Ce mois</Text>
              <Text style={styles.revenueValueSmall}>{(platformMonth?.total ?? 0).toFixed(2)}€</Text>
              <Text style={styles.revenueSub}>{platformMonth?.bookings_count ?? 0} loc.</Text>
            </View>
          </View>

          <View style={styles.revenueDivider} />

          <Text style={styles.revenueBreakdownTitle}>Détail (all-time)</Text>
          <View style={styles.revenueBreakdownRow}>
            <View style={styles.revenueBreakdownLeft}>
              <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.revenueBreakdownLabel}>Frais locataires</Text>
            </View>
            <Text style={styles.revenueBreakdownValue}>{Number(platformAllTime?.renter_fee ?? 0).toFixed(2)}€</Text>
          </View>
          <View style={styles.revenueBreakdownRow}>
            <View style={styles.revenueBreakdownLeft}>
              <Ionicons name="storefront-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.revenueBreakdownLabel}>Commission propriétaires</Text>
            </View>
            <Text style={styles.revenueBreakdownValue}>{Number(platformAllTime?.owner_commission ?? 0).toFixed(2)}€</Text>
          </View>

          <Text style={styles.revenueFooterNote}>
            Calculé sur les locations payées (PI capturé). Reflète le application_fee posé sur Stripe — la somme arrive directement sur le compte plateforme.
          </Text>
        </View>

        {/* Monthly stats table */}
        <Text style={styles.sectionTitle}>Statistiques mensuelles (6 mois)</Text>
        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Mois</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Rés.</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Revenus</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Litiges</Text>
          </View>
          {(data?.monthlyStats ?? []).map((row, i) => (
            <View key={row.month}>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.4, fontFamily: 'Inter-Medium' }]}>{row.month}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{row.bookings}</Text>
                <Text style={[styles.tableCell, { flex: 1.4, color: Colors.successGreen }]}>{row.revenue.toFixed(0)}€</Text>
                <Text style={[styles.tableCell, { flex: 1, color: row.disputes > 0 ? Colors.error : Colors.textMuted }]}>{row.disputes}</Text>
              </View>
              {i < (data?.monthlyStats ?? []).length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Top listings */}
        <Text style={styles.sectionTitle}>Top annonces (par réservations)</Text>
        <View style={styles.card}>
          {(data?.topListings ?? []).length === 0 ? (
            <Text style={styles.emptyText}>Aucune donnée</Text>
          ) : (data?.topListings ?? []).map((l, i) => (
            <View key={l.id}>
              <View style={styles.rankRow}>
                <Text style={styles.rankNumber}>{i + 1}</Text>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankTitle} numberOfLines={1}>{l.name}</Text>
                  <Text style={styles.rankSub}>{l.bookingCount} rés. · {l.revenue.toFixed(0)}€ générés</Text>
                </View>
              </View>
              {i < (data?.topListings ?? []).length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Top renters */}
        <Text style={styles.sectionTitle}>Top locataires</Text>
        <View style={styles.card}>
          {(data?.topRenters ?? []).length === 0 ? (
            <Text style={styles.emptyText}>Aucune donnée</Text>
          ) : (data?.topRenters ?? []).map((u, i) => (
            <View key={u.id}>
              <View style={styles.rankRow}>
                <Text style={styles.rankNumber}>{i + 1}</Text>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankTitle}>@{u.username ?? '-'}</Text>
                  <Text style={styles.rankSub}>{u.bookingCount} rés. · {u.totalAmount.toFixed(0)}€ dépensés</Text>
                </View>
              </View>
              {i < (data?.topRenters ?? []).length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Top owners */}
        <Text style={styles.sectionTitle}>Top propriétaires</Text>
        <View style={styles.card}>
          {(data?.topOwners ?? []).length === 0 ? (
            <Text style={styles.emptyText}>Aucune donnée</Text>
          ) : (data?.topOwners ?? []).map((u, i) => (
            <View key={u.id}>
              <View style={styles.rankRow}>
                <Text style={styles.rankNumber}>{i + 1}</Text>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankTitle}>@{u.username ?? '-'}</Text>
                  <Text style={styles.rankSub}>{u.bookingCount} rés. · {u.totalAmount.toFixed(0)}€ générés</Text>
                </View>
              </View>
              {i < (data?.topOwners ?? []).length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Reports & disputes summary */}
        <Text style={styles.sectionTitle}>Signalements & litiges</Text>
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.error }]}>{data?.openReports ?? 0}</Text>
              <Text style={styles.summaryLabel}>Signalements en attente</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.warning }]}>{data?.openDisputes ?? 0}</Text>
              <Text style={styles.summaryLabel}>Litiges ouverts</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.successGreen }]}>{data?.resolvedDisputes ?? 0}</Text>
              <Text style={styles.summaryLabel}>Litiges résolus</Text>
            </View>
          </View>
        </View>

        {/* Export */}
        {Platform.OS === 'web' && (
          <>
            <Text style={styles.sectionTitle}>Export des données du mois en cours</Text>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={handleExport}
              activeOpacity={0.8}
              disabled={exportLoading}
            >
              {exportLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="download-outline" size={18} color={Colors.white} />
              )}
              <Text style={styles.exportBtnText}>
                {exportLoading ? 'Export en cours...' : 'Exporter CSV (transactions, litiges, signalements)'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 24 : 56,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginRight: 12,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    flex: 1,
    letterSpacing: -0.4,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }),
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
    marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }),
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tableHeaderCell: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tableCell: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 16,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rankNumber: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.primaryDark,
    width: 24,
    textAlign: 'center',
  },
  rankInfo: {
    flex: 1,
    gap: 2,
  },
  rankTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.text,
  },
  rankSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
    alignSelf: 'stretch',
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    padding: 20,
    textAlign: 'center',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 20,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(142,152,120,0.3)' },
    }),
  },
  exportBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
  revenueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  revenueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  revenueHeaderRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  revenueLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  revenueValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  revenueValueSmall: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  revenueSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  revenueDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 14,
  },
  revenueBreakdownTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  revenueBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  revenueBreakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueBreakdownLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
  },
  revenueBreakdownValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  revenueFooterNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 12,
    lineHeight: 16,
  },
});
