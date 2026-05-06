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
import { fetchAdminProfileEmails } from '@/lib/adminEmails';

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
  // Two distinct PIs: rental is captured at payment time; deposit is
  // pre-authorized later (manual capture) and lives on the same column
  // historically named stripe_payment_intent_id.
  stripe_rental_payment_intent_id: string | null;
  stripe_payment_intent_id: string | null;
  // Deposit lifecycle audit columns
  deposit_authorized_at: string | null;
  deposit_captured_at: string | null;
  deposit_released_at: string | null;
  deposit_hold_failed: boolean | null;
  deposit_action: string | null;
  // Booking flow audit columns
  handover_at: string | null;
  return_confirmed_at: string | null;
  owner_validated: boolean | null;
  renter_id: string | null;
  owner_id: string | null;
  listing: { name: string } | null;
  renter: { username: string | null; email: string | null } | null;
  owner: { username: string | null; email: string | null } | null;
  flagged?: boolean;
}

type DepositState =
  | 'none'        // pas de caution sur le booking
  | 'pending'     // booking active mais hold pas encore tiré (cron J-2 / short rental)
  | 'authorized' // pré-autorisée sur la carte du locataire, en attente
  | 'captured'   // capturée par le loueur (renter doit payer)
  | 'released'   // libérée (cancel du PI), retour à la carte du locataire
  | 'failed';    // échec du hold automatique

function computeDepositState(b: Booking): DepositState {
  if (!b.deposit_amount) return 'none';
  if (b.deposit_action === 'release' || b.deposit_released_at) return 'released';
  if (b.deposit_action === 'capture' || b.deposit_captured_at) return 'captured';
  if (b.deposit_authorized_at) return 'authorized';
  if (b.deposit_hold_failed) return 'failed';
  return 'pending';
}

const DEPOSIT_STATE_META: Record<DepositState, { label: string; bg: string; fg: string }> = {
  none:       { label: 'Pas de caution', bg: '#E5E7EB', fg: '#374151' },
  pending:    { label: 'À tirer (cron J-2)', bg: '#E5E7EB', fg: '#374151' },
  authorized: { label: 'Pré-autorisée', bg: '#FEF3C7', fg: '#92400E' },
  captured:   { label: 'Capturée', bg: '#DBEAFE', fg: '#1E40AF' },
  released:   { label: 'Libérée', bg: '#D1FAE5', fg: '#065F46' },
  failed:     { label: 'Échec du hold', bg: '#FEE2E2', fg: '#991B1B' },
};

function stripePaymentUrl(pi: string): string {
  return `https://dashboard.stripe.com/payments/${pi}`;
}

function formatTs(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
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

  // Expanded payment-detail panel (one card open at a time)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Deposit action confirmation
  const [depositActionModal, setDepositActionModal] =
    useState<{ bookingId: string; action: 'capture' | 'release'; title: string } | null>(null);
  const [depositActionLoading, setDepositActionLoading] = useState(false);
  const [depositActionError, setDepositActionError] = useState<string | null>(null);

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
        `id, status, total_price, deposit_amount, start_date, end_date, created_at,
         stripe_rental_payment_intent_id, stripe_payment_intent_id,
         deposit_authorized_at, deposit_captured_at, deposit_released_at,
         deposit_hold_failed, deposit_action,
         handover_at, return_confirmed_at, owner_validated,
         renter_id, owner_id,
         listing:listings(name),
         renter:profiles!bookings_renter_id_fkey(username),
         owner:profiles!bookings_owner_id_fkey(username)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, count } = await query;
    const rows = (data as any[]) ?? [];

    const emails = await fetchAdminProfileEmails(
      rows.flatMap((b) => [b.renter_id, b.owner_id]),
    );
    let results: Booking[] = rows.map((b) => ({
      ...b,
      renter: b.renter
        ? { ...b.renter, email: b.renter_id ? emails[b.renter_id] ?? null : null }
        : null,
      owner: b.owner
        ? { ...b.owner, email: b.owner_id ? emails[b.owner_id] ?? null : null }
        : null,
    }));

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

  const submitDepositAction = async () => {
    if (!depositActionModal) return;
    setDepositActionLoading(true);
    setDepositActionError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({
          booking_id: depositActionModal.bookingId,
          action: depositActionModal.action,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setDepositActionError(result.error ?? 'Erreur.');
        setDepositActionLoading(false);
        return;
      }
      setDepositActionModal(null);
      await loadBookings();
    } catch {
      setDepositActionError('Erreur réseau.');
    }
    setDepositActionLoading(false);
  };

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
            const isExpanded = expandedId === b.id;
            const depositState = computeDepositState(b);
            const depositMeta = DEPOSIT_STATE_META[depositState];
            const canCapture = depositState === 'authorized';
            const canRelease = depositState === 'authorized';
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
                    {b.deposit_amount ? (
                      <View style={[styles.depositPill, { backgroundColor: depositMeta.bg }]}>
                        <Ionicons name="lock-closed-outline" size={11} color={depositMeta.fg} />
                        <Text style={[styles.depositPillText, { color: depositMeta.fg }]}>
                          Caution {b.deposit_amount}€ · {depositMeta.label}
                        </Text>
                      </View>
                    ) : null}
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

                {/* Expand toggle */}
                <TouchableOpacity
                  onPress={() => setExpandedId(isExpanded ? null : b.id)}
                  style={styles.detailToggle}
                  activeOpacity={0.7}
                >
                  <Ionicons name="card-outline" size={14} color={Colors.primaryDark} />
                  <Text style={styles.detailToggleText}>Détails paiement & caution</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={Colors.primaryDark}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.detailPanel}>
                    {/* Two PIs separated */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>PI loyer</Text>
                      {b.stripe_rental_payment_intent_id ? (
                        <TouchableOpacity
                          onPress={() => {
                            const url = stripePaymentUrl(b.stripe_rental_payment_intent_id!);
                            if (Platform.OS === 'web') window.open(url, '_blank');
                          }}
                          activeOpacity={0.7}
                          style={styles.detailLinkBtn}
                        >
                          <Text style={styles.detailLinkText} numberOfLines={1}>
                            {b.stripe_rental_payment_intent_id}
                          </Text>
                          <Ionicons name="open-outline" size={12} color={Colors.primaryDark} />
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.detailValueMuted}>—</Text>
                      )}
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>PI caution</Text>
                      {b.stripe_payment_intent_id ? (
                        <TouchableOpacity
                          onPress={() => {
                            const url = stripePaymentUrl(b.stripe_payment_intent_id!);
                            if (Platform.OS === 'web') window.open(url, '_blank');
                          }}
                          activeOpacity={0.7}
                          style={styles.detailLinkBtn}
                        >
                          <Text style={styles.detailLinkText} numberOfLines={1}>
                            {b.stripe_payment_intent_id}
                          </Text>
                          <Ionicons name="open-outline" size={12} color={Colors.primaryDark} />
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.detailValueMuted}>—</Text>
                      )}
                    </View>

                    {/* Audit timeline */}
                    <View style={styles.detailDivider} />
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Caution pré-autorisée</Text>
                      <Text style={styles.detailValue}>{formatTs(b.deposit_authorized_at)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Caution capturée</Text>
                      <Text style={styles.detailValue}>{formatTs(b.deposit_captured_at)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Caution libérée</Text>
                      <Text style={styles.detailValue}>{formatTs(b.deposit_released_at)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Remise (handover)</Text>
                      <Text style={styles.detailValue}>{formatTs(b.handover_at)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Retour confirmé</Text>
                      <Text style={styles.detailValue}>{formatTs(b.return_confirmed_at)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Validation owner</Text>
                      <Text style={styles.detailValue}>{b.owner_validated ? 'Oui' : '—'}</Text>
                    </View>

                    {/* Admin actions */}
                    {(canCapture || canRelease) && (
                      <View style={styles.depositActionsRow}>
                        <TouchableOpacity
                          style={[styles.depositBtn, styles.depositBtnRelease]}
                          onPress={() =>
                            setDepositActionModal({
                              bookingId: b.id,
                              action: 'release',
                              title: b.listing?.name ?? '-',
                            })
                          }
                          activeOpacity={0.85}
                        >
                          <Ionicons name="lock-open-outline" size={14} color="#065F46" />
                          <Text style={styles.depositBtnReleaseText}>Libérer la caution</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.depositBtn, styles.depositBtnCapture]}
                          onPress={() =>
                            setDepositActionModal({
                              bookingId: b.id,
                              action: 'capture',
                              title: b.listing?.name ?? '-',
                            })
                          }
                          activeOpacity={0.85}
                        >
                          <Ionicons name="cash-outline" size={14} color="#FFFFFF" />
                          <Text style={styles.depositBtnCaptureText}>Capturer la caution</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
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

      <Modal
        visible={depositActionModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDepositActionModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {depositActionModal?.action === 'capture' ? 'Capturer la caution' : 'Libérer la caution'}
            </Text>
            <Text style={styles.modalDesc}>
              {depositActionModal?.action === 'capture'
                ? `La carte du locataire sera débitée du montant de la caution. Action irréversible. Réservation : ${depositActionModal?.title ?? '-'}`
                : `La pré-autorisation est annulée et le booking passe à completed. Réservation : ${depositActionModal?.title ?? '-'}`}
            </Text>
            {depositActionError ? <Text style={styles.modalError}>{depositActionError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDepositActionModal(null)}
                activeOpacity={0.7}
                disabled={depositActionLoading}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  depositActionModal?.action === 'release' && { backgroundColor: '#065F46' },
                ]}
                onPress={submitDepositAction}
                activeOpacity={0.85}
                disabled={depositActionLoading}
              >
                {depositActionLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {depositActionModal?.action === 'capture' ? 'Capturer' : 'Libérer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  depositPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  depositPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  detailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F5F2E3',
    marginTop: 8,
  },
  detailToggleText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
    flex: 1,
  },
  detailPanel: {
    marginTop: 8,
    paddingTop: 10,
    paddingHorizontal: 4,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  detailValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.text,
    textAlign: 'right',
    flex: 1,
  },
  detailValueMuted: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'right',
    flex: 1,
  },
  detailLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  detailLinkText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 10,
    color: Colors.primaryDark,
    flexShrink: 1,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  depositActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  depositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
  },
  depositBtnRelease: {
    backgroundColor: '#D1FAE5',
  },
  depositBtnReleaseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#065F46',
  },
  depositBtnCapture: {
    backgroundColor: '#1E40AF',
  },
  depositBtnCaptureText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
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
