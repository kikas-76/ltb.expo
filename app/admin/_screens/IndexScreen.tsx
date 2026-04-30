import { useEffect, useState } from 'react';
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
import StatusBadge from '@/components/admin/StatusBadge';

interface Metrics {
  users: number;
  activeListings: number;
  activeBookings: number;
  openDisputes: number;
  pendingReports: number;
  monthlyRevenue: number;
  restrictedAccounts: number;
}

interface RecentDispute {
  id: string;
  status: string;
  created_at: string;
  description: string;
  reporter: { username: string | null } | null;
  booking: { listing: { name: string } | null } | null;
}

interface RecentBooking {
  id: string;
  status: string;
  total_price: number;
  start_date: string;
  end_date: string;
  listing: { name: string } | null;
  renter: { username: string | null } | null;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [disputes, setDisputes] = useState<RecentDispute[]>([]);
  const [bookings, setBookings] = useState<RecentBooking[]>([]);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const [
      { count: users },
      { count: activeListings },
      { count: activeBookings },
      { count: openDisputes },
      { count: pendingReports },
      { data: restrictedAccountsRaw },
      { data: monthBookings },
      { data: recentDisputes },
      { data: recentBookings },
      { count: flagged },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      // SELECT * trips the column-level grant on listings (latitude /
      // longitude / location_data are revoked from authenticated, so
      // expanding * 403s the entire query). Restrict to a single
      // always-granted column; head:true keeps it count-only.
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).in('status', ['pending_payment', 'active', 'in_progress']),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.rpc('admin_count_restricted_accounts'),
      supabase.from('bookings').select('total_price, status').gte('created_at', monthStart).lte('created_at', monthEnd),
      // disputes_reporter_id_fkey targets auth.users, not public.profiles,
      // so PostgREST can't resolve `profiles!disputes_reporter_id_fkey`.
      // Drop the embed; the dashboard card doesn't actually display the
      // reporter username, so dropping it is loss-less.
      supabase.from('disputes')
        .select('id, status, created_at, description, booking:bookings(listing:listings(name))')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('bookings')
        .select('id, status, total_price, start_date, end_date, listing:listings(name), renter:profiles!bookings_renter_id_fkey(username)')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('admin_audit_logs').select('*', { count: 'exact', head: true }).eq('action', 'flag_transaction'),
    ]);

    const completedMonthBookings = (monthBookings ?? []).filter((b: any) => b.status === 'completed');
    const monthlyRevenue = completedMonthBookings.reduce((s: number, b: any) => s + (b.total_price ?? 0), 0);

    setMetrics({
      users: users ?? 0,
      activeListings: activeListings ?? 0,
      activeBookings: activeBookings ?? 0,
      openDisputes: openDisputes ?? 0,
      pendingReports: pendingReports ?? 0,
      monthlyRevenue,
      restrictedAccounts: Number(restrictedAccountsRaw ?? 0),
    });
    setDisputes((recentDisputes as any) ?? []);
    setBookings((recentBookings as any) ?? []);
    setFlaggedCount(flagged ?? 0);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
      </View>
    );
  }

  const metricCards = [
    { label: 'Utilisateurs', value: metrics?.users ?? 0, icon: 'people-outline', color: Colors.info },
    { label: 'Annonces disponibles', value: metrics?.activeListings ?? 0, icon: 'pricetags-outline', color: Colors.primary },
    { label: 'Réservations actives', value: metrics?.activeBookings ?? 0, icon: 'calendar-outline', color: Colors.primaryDark },
    { label: 'Litiges ouverts', value: metrics?.openDisputes ?? 0, icon: 'warning-outline', color: Colors.error },
    { label: 'Signalements', value: metrics?.pendingReports ?? 0, icon: 'flag-outline', color: Colors.warning },
    { label: 'Revenus du mois', value: `${(metrics?.monthlyRevenue ?? 0).toFixed(0)}€`, icon: 'cash-outline', color: Colors.successGreen },
    { label: 'Comptes restreints', value: metrics?.restrictedAccounts ?? 0, icon: 'ban-outline', color: Colors.banned },
  ];

  const navLinks = [
    { label: 'Litiges', icon: 'warning-outline', route: '/admin/disputes' },
    { label: 'Signalements', icon: 'flag-outline', route: '/admin/reports' },
    { label: 'Utilisateurs', icon: 'people-outline', route: '/admin/users' },
    { label: 'Réservations', icon: 'calendar-outline', route: '/admin/bookings' },
    { label: 'Transactions', icon: 'receipt-outline', route: '/admin/transactions' },
    { label: 'Analyses', icon: 'bar-chart-outline', route: '/admin/analytics' },
    { label: 'Journal d\'audit', icon: 'document-text-outline', route: '/admin/audit' },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Administration</Text>
          <Text style={styles.subtitle}>Vue d'ensemble de la plateforme</Text>
        </View>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {flaggedCount > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => router.push('/admin/transactions' as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="warning-outline" size={18} color={Colors.error} />
          <Text style={styles.alertBannerText}>
            {flaggedCount} transaction{flaggedCount > 1 ? 's' : ''} signalée{flaggedCount > 1 ? 's' : ''} comme suspecte{flaggedCount > 1 ? 's' : ''}
          </Text>
          <Ionicons name="chevron-forward-outline" size={16} color={Colors.error} style={{ marginLeft: 'auto' as any }} />
        </TouchableOpacity>
      )}

      <View style={styles.metricsGrid}>
        {metricCards.map((card) => (
          <View key={card.label} style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: card.color + '18' }]}>
              <Ionicons name={card.icon as any} size={22} color={card.color} />
            </View>
            <Text style={styles.metricValue}>{card.value}</Text>
            <Text style={styles.metricLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.navGrid}>
        {navLinks.map((link) => (
          <TouchableOpacity
            key={link.label}
            style={styles.navCard}
            onPress={() => router.push(link.route as any)}
            activeOpacity={0.75}
          >
            <Ionicons name={link.icon as any} size={20} color={Colors.primaryDark} />
            <Text style={styles.navLabel}>{link.label}</Text>
            <Ionicons name="chevron-forward-outline" size={14} color={Colors.textMuted} style={{ marginLeft: 'auto' as any }} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Litiges récents</Text>
      <View style={styles.card}>
        {disputes.length === 0 ? (
          <Text style={styles.empty}>Aucun litige</Text>
        ) : disputes.map((d, i) => (
          <View key={d.id}>
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => router.push('/admin/disputes' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.listRowContent}>
                <Text style={styles.listRowTitle} numberOfLines={1}>
                  {d.booking?.listing?.name ?? 'Annonce inconnue'}
                </Text>
                <Text style={styles.listRowSub} numberOfLines={1}>
                  Par @{d.reporter?.username ?? '?'} · {new Date(d.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <StatusBadge status={d.status} small />
            </TouchableOpacity>
            {i < disputes.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Dernières réservations</Text>
      <View style={styles.card}>
        {bookings.length === 0 ? (
          <Text style={styles.empty}>Aucune réservation</Text>
        ) : bookings.map((b, i) => (
          <View key={b.id}>
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => router.push('/admin/bookings' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.listRowContent}>
                <Text style={styles.listRowTitle} numberOfLines={1}>
                  {b.listing?.name ?? 'Annonce inconnue'}
                </Text>
                <Text style={styles.listRowSub} numberOfLines={1}>
                  @{b.renter?.username ?? '?'} · {b.total_price}€
                </Text>
              </View>
              <StatusBadge status={b.status} small />
            </TouchableOpacity>
            {i < bookings.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 32 : 56,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 2,
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
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  alertBannerText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
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
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  navGrid: {
    gap: 8,
    marginBottom: 28,
  },
  navCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  navLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.text,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }),
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  listRowContent: {
    flex: 1,
  },
  listRowTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.text,
  },
  listRowSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 16,
  },
  empty: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
    padding: 20,
    textAlign: 'center',
  },
});
