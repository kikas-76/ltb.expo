import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

interface ProStatsKpis {
  revenue_this_month_net: number;
  bookings_this_month: number;
  rating_avg: number | null;
  rating_count: number | null;
  open_disputes: number;
}

interface ProStatsRevenue {
  all_time_gross: number;
  all_time_commission: number;
  all_time_net: number;
  this_month_gross: number;
  this_month_commission: number;
  this_month_net: number;
  all_time_bookings_count: number;
}

interface MonthBucket {
  month: string;
  bookings: number;
  revenue: number;
}

interface FunnelData {
  views: number;
  saves: number;
  requests: number;
  bookings: number;
}

interface TopListing {
  id: string;
  name: string;
  photo: string | null;
  bookings: number;
  revenue: number;
}

interface RecentReview {
  rating: number;
  comment: string | null;
  reviewer_username: string | null;
  reviewer_photo_url: string | null;
  listing_name: string | null;
  created_at: string;
}

interface StripeStatus {
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  details_submitted: boolean | null;
  payouts_delay_days: number;
}

interface ProStatsData {
  kpis: ProStatsKpis;
  revenue: ProStatsRevenue;
  monthly_stats: MonthBucket[];
  funnel_this_month: FunnelData;
  top_listings: TopListing[];
  recent_reviews: RecentReview[];
  stripe: StripeStatus;
}

function formatMonthLabel(yyyymm: string): string {
  // 'YYYY-MM' → 'mai 26'
  const [y, m] = yyyymm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function formatPct(num: number, den: number): string {
  if (!den) return '—';
  return `${((num / den) * 100).toFixed(1)}%`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function ProStatsScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<ProStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_pro_stats_summary');
    if (rpcError || (rpcData as any)?.error) {
      setError((rpcData as any)?.error ?? rpcError?.message ?? 'Erreur de chargement');
      setLoading(false);
      return;
    }
    setData(rpcData as ProStatsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.root}>
        <Header onRefresh={load} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.errorBtn}
            onPress={() => router.replace('/(tabs)/profil' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.errorBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!data) return null;

  const { kpis, revenue, monthly_stats, funnel_this_month: f, top_listings, recent_reviews, stripe } = data;

  const stripeOk = stripe.charges_enabled && stripe.payouts_enabled;

  const kpiCards = [
    {
      label: 'Revenu net ce mois',
      value: `${Number(kpis.revenue_this_month_net).toFixed(2)}€`,
      icon: 'wallet-outline' as const,
      color: Colors.primaryDark,
    },
    {
      label: 'Locations ce mois',
      value: String(kpis.bookings_this_month ?? 0),
      icon: 'cube-outline' as const,
      color: '#1E40AF',
    },
    {
      label: 'Note moyenne',
      value: kpis.rating_count
        ? `${Number(kpis.rating_avg ?? 0).toFixed(1)}★`
        : '—',
      icon: 'star-outline' as const,
      color: '#92400E',
    },
    {
      label: 'Litiges ouverts',
      value: String(kpis.open_disputes ?? 0),
      icon: 'warning-outline' as const,
      color: kpis.open_disputes > 0 ? '#C0392B' : Colors.textMuted,
    },
  ];

  return (
    <View style={styles.root}>
      <Header onRefresh={load} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* KPI strip */}
        <View style={styles.kpiGrid}>
          {kpiCards.map((k) => (
            <View key={k.label} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + '18' }]}>
                <Ionicons name={k.icon} size={20} color={k.color} />
              </View>
              <Text style={styles.kpiValue}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
              {k.label === 'Note moyenne' && kpis.rating_count ? (
                <Text style={styles.kpiSub}>{kpis.rating_count} avis</Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Revenue panel */}
        <Text style={styles.sectionTitle}>Revenus (après commission)</Text>
        <View style={styles.card}>
          <View style={styles.revenueHeaderRow}>
            <View style={styles.revenueHeaderLeft}>
              <View style={[styles.kpiIcon, { backgroundColor: Colors.primaryDark + '18' }]}>
                <Ionicons name="wallet-outline" size={22} color={Colors.primaryDark} />
              </View>
              <View>
                <Text style={styles.revenueLabel}>Net all-time</Text>
                <Text style={styles.revenueValue}>{Number(revenue.all_time_net).toFixed(2)}€</Text>
                <Text style={styles.revenueSub}>
                  {revenue.all_time_bookings_count} location{revenue.all_time_bookings_count > 1 ? 's' : ''} · brut {Number(revenue.all_time_gross).toFixed(2)}€
                </Text>
              </View>
            </View>
            <View style={styles.revenueHeaderRight}>
              <Text style={styles.revenueLabel}>Ce mois</Text>
              <Text style={styles.revenueValueSmall}>{Number(revenue.this_month_net).toFixed(2)}€</Text>
              <Text style={styles.revenueSub}>net</Text>
            </View>
          </View>

          <View style={styles.revenueDivider} />

          <Text style={styles.revenueBreakdownTitle}>Détail (all-time)</Text>
          <View style={styles.revenueBreakdownRow}>
            <Text style={styles.revenueBreakdownLabel}>Loyer brut encaissé</Text>
            <Text style={styles.revenueBreakdownValue}>{Number(revenue.all_time_gross).toFixed(2)}€</Text>
          </View>
          <View style={styles.revenueBreakdownRow}>
            <Text style={styles.revenueBreakdownLabel}>− Commission plateforme</Text>
            <Text style={[styles.revenueBreakdownValue, { color: '#C0392B' }]}>−{Number(revenue.all_time_commission).toFixed(2)}€</Text>
          </View>
          <View style={[styles.revenueBreakdownRow, { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 8, marginTop: 4 }]}>
            <Text style={[styles.revenueBreakdownLabel, { fontWeight: '700' }]}>Net dans ta poche</Text>
            <Text style={[styles.revenueBreakdownValue, { color: Colors.primaryDark, fontSize: 16 }]}>{Number(revenue.all_time_net).toFixed(2)}€</Text>
          </View>

          <Text style={styles.footerNote}>
            Les locations comptent dès que le paiement est capturé (statut ≥ active). La commission plateforme est calculée par annonce selon ton pourcentage configuré.
          </Text>
        </View>

        {/* Monthly activity */}
        <Text style={styles.sectionTitle}>Activité (6 derniers mois)</Text>
        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Mois</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Loc.</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.4, textAlign: 'right' }]}>Net</Text>
          </View>
          {monthly_stats.map((m, i) => (
            <View key={m.month} style={[styles.tableRow, i === monthly_stats.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={[styles.tableCell, { flex: 1.4 }]}>{formatMonthLabel(m.month)}</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{m.bookings}</Text>
              <Text style={[styles.tableCell, { flex: 1.4, textAlign: 'right', fontFamily: 'Inter-SemiBold' }]}>{Number(m.revenue).toFixed(0)}€</Text>
            </View>
          ))}
        </View>

        {/* Funnel */}
        <Text style={styles.sectionTitle}>Funnel de conversion (ce mois)</Text>
        <View style={styles.card}>
          <FunnelStep icon="eye-outline"           label="Vues totales"      value={f.views}    sub={null} />
          <FunnelStep icon="heart-outline"         label="Sauvegardes"       value={f.saves}    sub={`${formatPct(f.saves, f.views)} des vues`} />
          <FunnelStep icon="paper-plane-outline"   label="Demandes reçues"   value={f.requests} sub={`${formatPct(f.requests, f.saves)} des sauvegardes`} />
          <FunnelStep icon="cash-outline"          label="Locations payées"  value={f.bookings} sub={`${formatPct(f.bookings, f.requests)} des demandes`} isLast />
          <Text style={styles.footerNote}>
            Les vues/sauvegardes sont des compteurs all-time sur tes annonces ; les demandes/locations sont filtrées sur ce mois. Cherche les chutes brutales pour identifier où tu perds des clients.
          </Text>
        </View>

        {/* Top listings */}
        {top_listings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top annonces (par revenu)</Text>
            <View style={styles.card}>
              {top_listings.map((l, i) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.listingRow, i === top_listings.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => router.push(`/listing/${l.id}` as any)}
                  activeOpacity={0.75}
                >
                  {l.photo ? (
                    <Image source={{ uri: l.photo }} style={styles.listingThumb} />
                  ) : (
                    <View style={[styles.listingThumb, styles.listingThumbFallback]}>
                      <Ionicons name="cube-outline" size={20} color={Colors.primary} />
                    </View>
                  )}
                  <View style={styles.listingBody}>
                    <Text style={styles.listingName} numberOfLines={1}>{l.name}</Text>
                    <Text style={styles.listingMeta}>{l.bookings} location{l.bookings > 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.listingRevenue}>{Number(l.revenue).toFixed(0)}€</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Recent reviews */}
        {recent_reviews.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Derniers avis reçus</Text>
            <View style={styles.card}>
              {recent_reviews.map((r, i) => (
                <View key={i} style={[styles.reviewRow, i === recent_reviews.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.reviewHeader}>
                    {r.reviewer_photo_url ? (
                      <Image source={{ uri: r.reviewer_photo_url }} style={styles.reviewAvatar} />
                    ) : (
                      <View style={[styles.reviewAvatar, styles.reviewAvatarFallback]}>
                        <Ionicons name="person-outline" size={14} color={Colors.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewName}>@{r.reviewer_username ?? 'utilisateur'}</Text>
                      <Text style={styles.reviewMeta}>
                        {r.listing_name ?? '—'} · {formatRelative(r.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(Math.max(0, 5 - r.rating))}</Text>
                  </View>
                  {r.comment ? (
                    <Text style={styles.reviewComment} numberOfLines={3}>{r.comment}</Text>
                  ) : null}
                </View>
              ))}
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={() => user?.id && router.push(`/owner/${user.id}` as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>Voir tous les avis</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Stripe status */}
        <Text style={styles.sectionTitle}>Compte de paiement Stripe</Text>
        <View style={styles.card}>
          <View style={styles.stripeRow}>
            <View style={[styles.stripeBadge, { backgroundColor: stripeOk ? '#D1FAE5' : '#FEF3C7' }]}>
              <Ionicons
                name={stripeOk ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={stripeOk ? '#065F46' : '#92400E'}
              />
              <Text style={[styles.stripeBadgeText, { color: stripeOk ? '#065F46' : '#92400E' }]}>
                {stripeOk ? 'Compte activé' : 'Action requise'}
              </Text>
            </View>
            <Text style={styles.stripeMeta}>Virements à J+{stripe.payouts_delay_days}</Text>
          </View>
          {!stripeOk && (
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => router.push('/wallet/onboarding' as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.completeBtnText}>Compléter mon compte Stripe</Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <Text style={styles.footerNote}>
            Les revenus arrivent sur ton compte bancaire après le délai standard de {stripe.payouts_delay_days} jours fixé par Stripe Connect.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function Header({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Statistiques pro</Text>
      <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} activeOpacity={0.7}>
        <Ionicons name="refresh-outline" size={20} color={Colors.primaryDark} />
      </TouchableOpacity>
    </View>
  );
}

function FunnelStep({
  icon, label, value, sub, isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  sub: string | null;
  isLast?: boolean;
}) {
  return (
    <>
      <View style={styles.funnelRow}>
        <View style={styles.funnelIconWrap}>
          <Ionicons name={icon} size={18} color={Colors.primaryDark} />
        </View>
        <View style={styles.funnelBody}>
          <Text style={styles.funnelLabel}>{label}</Text>
          {sub ? <Text style={styles.funnelSub}>{sub}</Text> : null}
        </View>
        <Text style={styles.funnelValue}>{value}</Text>
      </View>
      {!isLast && <View style={styles.funnelConnector} />}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 24 : 56,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderLight,
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  errorText: {
    fontFamily: 'Inter-Medium', fontSize: 14, color: Colors.text,
    paddingHorizontal: 32, textAlign: 'center',
  },
  errorBtn: {
    paddingVertical: 12, paddingHorizontal: 32,
    borderRadius: 999, backgroundColor: Colors.primaryDark,
  },
  errorBtnText: {
    fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#FFFFFF',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 16 },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  kpiIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  kpiValue: {
    fontFamily: 'Inter-Bold', fontSize: 22, color: Colors.text, letterSpacing: -0.4,
  },
  kpiLabel: {
    fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.textMuted,
  },
  kpiSub: {
    fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.textMuted,
  },

  sectionTitle: {
    fontFamily: 'Inter-Bold', fontSize: 16, color: Colors.text,
    marginTop: 8,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 6,
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
    fontFamily: 'Inter-Medium', fontSize: 11, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  revenueValue: {
    fontFamily: 'Inter-Bold', fontSize: 26, color: Colors.text, letterSpacing: -0.5, marginTop: 2,
  },
  revenueValueSmall: {
    fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.text, letterSpacing: -0.3,
  },
  revenueSub: {
    fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.textMuted,
  },
  revenueDivider: {
    height: 1, backgroundColor: Colors.borderLight, marginVertical: 12,
  },
  revenueBreakdownTitle: {
    fontFamily: 'Inter-SemiBold', fontSize: 12, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
  },
  revenueBreakdownRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 6,
  },
  revenueBreakdownLabel: {
    fontFamily: 'Inter-Medium', fontSize: 13, color: Colors.text,
  },
  revenueBreakdownValue: {
    fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.text,
  },
  footerNote: {
    fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.textMuted,
    marginTop: 10, lineHeight: 16,
  },

  tableHeader: {
    flexDirection: 'row', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: 4,
  },
  tableHeaderCell: {
    fontFamily: 'Inter-SemiBold', fontSize: 11, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  tableCell: {
    fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.text,
  },

  funnelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8,
  },
  funnelIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryDark + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  funnelBody: { flex: 1 },
  funnelLabel: {
    fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.text,
  },
  funnelSub: {
    fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.textMuted, marginTop: 2,
  },
  funnelValue: {
    fontFamily: 'Inter-Bold', fontSize: 18, color: Colors.text, fontVariant: ['tabular-nums'],
  },
  funnelConnector: {
    width: 2, height: 12,
    backgroundColor: Colors.borderLight,
    marginLeft: 17,
  },

  listingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  listingThumb: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primarySurface,
  },
  listingThumbFallback: {
    alignItems: 'center', justifyContent: 'center',
  },
  listingBody: { flex: 1 },
  listingName: {
    fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.text,
  },
  listingMeta: {
    fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2,
  },
  listingRevenue: {
    fontFamily: 'Inter-Bold', fontSize: 15, color: Colors.primaryDark,
  },

  reviewRow: {
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    gap: 6,
  },
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  reviewAvatar: {
    width: 32, height: 32, borderRadius: 16,
  },
  reviewAvatarFallback: {
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  reviewName: {
    fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.text,
  },
  reviewMeta: {
    fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1,
  },
  reviewStars: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, color: '#92400E', letterSpacing: 1,
  },
  reviewComment: {
    fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.text,
    lineHeight: 18, paddingLeft: 42,
  },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingTop: 12,
  },
  seeAllText: {
    fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.primaryDark,
  },

  stripeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  stripeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
  },
  stripeBadgeText: {
    fontFamily: 'Inter-SemiBold', fontSize: 12,
  },
  stripeMeta: {
    fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.textMuted,
  },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12,
    borderRadius: 999, backgroundColor: Colors.primaryDark, marginTop: 8,
  },
  completeBtnText: {
    fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#FFFFFF',
  },
});
