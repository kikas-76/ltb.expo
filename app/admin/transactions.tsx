import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import StatusBadge from '@/components/admin/StatusBadge';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

interface Booking {
  id: string;
  status: string;
  total_price: number;
  deposit_amount: number | null;
  start_date: string;
  end_date: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
  listing: { name: string } | null;
  renter: { username: string | null; email: string | null } | null;
  owner: { username: string | null; email: string | null } | null;
  flagged?: boolean;
}

type StatusFilter = 'all' | 'pending' | 'accepted' | 'pending_payment' | 'active' | 'completed' | 'cancelled';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'accepted', label: 'Acceptés' },
  { key: 'pending_payment', label: 'Paiement' },
  { key: 'active', label: 'Actifs' },
  { key: 'completed', label: 'Terminés' },
  { key: 'cancelled', label: 'Annulés' },
];

const PAGE_SIZE = 25;

export default function AdminTransactions() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [flagModal, setFlagModal] = useState<{ bookingId: string; title: string } | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagLoading, setFlagLoading] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);

  const loadFlaggedIds = useCallback(async () => {
    const { data } = await supabase
      .from('admin_audit_logs')
      .select('target_id')
      .eq('action', 'flag_transaction');
    if (data) setFlaggedIds(new Set((data as any[]).map((d) => d.target_id)));
  }, []);

  const loadBookings = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('bookings')
      .select(
        'id, status, total_price, deposit_amount, start_date, end_date, created_at, stripe_payment_intent_id, listing:listings(name), renter:profiles!bookings_renter_id_fkey(username, email), owner:profiles!bookings_owner_id_fkey(username, email)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, count } = await query;
    let results: Booking[] = (data as any) ?? [];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(
        (b) =>
          (b.renter?.username ?? '').toLowerCase().includes(q) ||
          (b.owner?.username ?? '').toLowerCase().includes(q) ||
          (b.listing?.name ?? '').toLowerCase().includes(q)
      );
    }

    setBookings(results);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadFlaggedIds();
    loadBookings();
  }, [loadFlaggedIds, loadBookings]);

  const submitFlag = async () => {
    if (!flagModal) return;
    if (!flagReason.trim()) {
      setFlagError('Le motif est obligatoire.');
      return;
    }

    setFlagLoading(true);
    setFlagError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({
          action: 'flag_transaction',
          target_id: flagModal.bookingId,
          reason: flagReason.trim(),
          details: { listing_title: flagModal.title },
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setFlagError(result.error ?? 'Erreur.');
        setFlagLoading(false);
        return;
      }

      setFlaggedIds((prev) => new Set([...prev, flagModal.bookingId]));
      setFlagModal(null);
      setFlagReason('');
    } catch {
      setFlagError('Erreur réseau.');
    }

    setFlagLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Transactions</Text>
        <TouchableOpacity onPress={() => { loadFlaggedIds(); loadBookings(); }} style={styles.refreshBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher annonce, locataire, propriétaire..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, statusFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.count}>{total} transaction{total !== 1 ? 's' : ''}</Text>

          {bookings.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={40} color={Colors.primaryDark} />
              <Text style={styles.emptyText}>Aucune transaction trouvée</Text>
            </View>
          ) : bookings.map((b) => {
            const isFlagged = flaggedIds.has(b.id);
            return (
              <View key={b.id} style={[styles.card, isFlagged && styles.cardFlagged]}>
                {isFlagged && (
                  <View style={styles.flagBanner}>
                    <Ionicons name="warning-outline" size={13} color={Colors.error} />
                    <Text style={styles.flagBannerText}>Activité signalée</Text>
                  </View>
                )}
                <View style={styles.cardTopRow}>
                  <Text style={styles.listingTitle} numberOfLines={1}>{b.listing?.name ?? '-'}</Text>
                  <StatusBadge status={b.status} small />
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.cardMeta}>
                    Loc. @{b.renter?.username ?? '?'} · Prop. @{(b.owner as any)?.username ?? '?'}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.cardMeta}>
                    {new Date(b.start_date).toLocaleDateString('fr-FR')} → {new Date(b.end_date).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <View style={styles.cardBottomRow}>
                  <View style={styles.amountGroup}>
                    <Text style={styles.amount}>{b.total_price}€</Text>
                    {b.deposit_amount ? <Text style={styles.deposit}>Dépôt : {b.deposit_amount}€</Text> : null}
                  </View>
                  {!isFlagged && (
                    <TouchableOpacity
                      style={styles.flagBtn}
                      onPress={() => {
                        setFlagModal({ bookingId: b.id, title: b.listing?.name ?? '-' });
                        setFlagReason('');
                        setFlagError(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flag-outline" size={14} color={Colors.error} />
                      <Text style={styles.flagBtnText}>Signaler</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {b.stripe_payment_intent_id && (
                  <Text style={styles.stripeId} numberOfLines={1}>Stripe: {b.stripe_payment_intent_id}</Text>
                )}
              </View>
            );
          })}

          {totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back-outline" size={18} color={page === 0 ? Colors.textMuted : Colors.text} />
                <Text style={[styles.pageBtnText, page === 0 && styles.pageBtnTextDisabled]}>Précédent</Text>
              </TouchableOpacity>
              <Text style={styles.pageInfo}>{page + 1} / {totalPages}</Text>
              <TouchableOpacity
                style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                activeOpacity={0.7}
              >
                <Text style={[styles.pageBtnText, page >= totalPages - 1 && styles.pageBtnTextDisabled]}>Suivant</Text>
                <Ionicons name="chevron-forward-outline" size={18} color={page >= totalPages - 1 ? Colors.textMuted : Colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={flagModal !== null} transparent animationType="fade" onRequestClose={() => setFlagModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Signaler une activité suspecte</Text>
            <Text style={styles.modalDesc} numberOfLines={2}>
              Réservation : {flagModal?.title}
            </Text>
            <Text style={styles.modalLabel}>Motif *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Décrivez l'activité suspecte..."
              placeholderTextColor={Colors.textMuted}
              value={flagReason}
              onChangeText={setFlagReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            {flagError ? <Text style={styles.modalError}>{flagError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setFlagModal(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={submitFlag}
                activeOpacity={0.8}
                disabled={flagLoading}
              >
                {flagLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Signaler</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
    padding: 0,
  },
  filterScroll: { flexGrow: 0, marginBottom: 12 },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterChipText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 10,
  },
  count: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
    }),
  },
  cardFlagged: {
    borderWidth: 1.5,
    borderColor: Colors.error + '50',
  },
  flagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  flagBannerText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.error,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  listingTitle: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  amountGroup: {
    gap: 2,
  },
  amount: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: Colors.text,
  },
  deposit: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.errorLight,
  },
  flagBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.error,
  },
  stripeId: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
  },
  pageBtnTextDisabled: { color: Colors.textMuted },
  pageInfo: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 10 },
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
    }),
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    marginBottom: 6,
  },
  modalDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  modalLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  modalError: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.error,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
});
