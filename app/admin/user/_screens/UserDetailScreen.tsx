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
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import StatusBadge from '@/components/admin/StatusBadge';
import {
  deriveConnectStatus,
  connectStatusLabel,
  connectStatusColors,
} from '@/lib/stripeConnectStatus';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  phone_number: string | null;
  bio: string | null;
  is_pro: boolean;
  role: string | null;
  account_status: string;
  ban_reason: string | null;
  banned_until: string | null;
  created_at: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
  stripe_details_submitted: boolean | null;
  stripe_requirements: {
    past_due?: string[] | null;
    currently_due?: string[] | null;
    disabled_reason?: string | null;
    current_deadline?: number | null;
  } | null;
  location_data: any;
  business_name: string | null;
  siren_number: string | null;
}

interface AccountEvent {
  id: string;
  event_type: string;
  reason: string;
  duration_days: number | null;
  expires_at: string | null;
  created_at: string;
  performed_by_username: string | null;
}

interface Booking {
  id: string;
  status: string;
  total_price: number;
  start_date: string;
  end_date: string;
  listing_name: string | null;
  other_username: string | null;
}

interface Listing {
  id: string;
  name: string;
  is_active: boolean;
  price: number;
  created_at: string;
}

interface Dispute {
  id: string;
  status: string;
  description: string;
  created_at: string;
  listing_name: string | null;
}

interface Report {
  id: string;
  status: string;
  category: string | null;
  description: string | null;
  created_at: string;
  target_type: string;
  target_id: string | null;
}

interface Favorite {
  listing_id: string;
  saved_at: string;
  listing_name: string | null;
  is_active: boolean | null;
  owner_username: string | null;
}

interface Conversation {
  id: string;
  status: string;
  created_at: string;
  start_date: string;
  end_date: string;
  listing_name: string | null;
  is_requester: boolean;
  other_username: string | null;
  last_message_at: string | null;
}

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<AccountEvent[]>([]);
  const [bookingsAsRenter, setBookingsAsRenter] = useState<Booking[]>([]);
  const [bookingsAsOwner, setBookingsAsOwner] = useState<Booking[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [modalType, setModalType] = useState<'suspend' | 'ban' | 'unban' | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    // Single SECURITY DEFINER RPC: bypasses column-level grants on
    // profiles (email, role, account_status, stripe_*) and consolidates
    // every related dataset (events, bookings, listings, disputes,
    // reports, favorites, conversations) the admin needs.
    const { data } = await supabase.rpc('admin_get_user_details', {
      p_user_id: id,
    });

    const payload = (data as {
      profile: UserProfile | null;
      events: AccountEvent[];
      bookings_as_renter: Booking[];
      bookings_as_owner: Booking[];
      listings: Listing[];
      disputes_filed: Dispute[];
      reports_filed: Report[];
      favorites: Favorite[];
      conversations: Conversation[];
    } | null) ?? null;

    setProfile(payload?.profile ?? null);
    setEvents(payload?.events ?? []);
    setBookingsAsRenter(payload?.bookings_as_renter ?? []);
    setBookingsAsOwner(payload?.bookings_as_owner ?? []);
    setListings(payload?.listings ?? []);
    setDisputes(payload?.disputes_filed ?? []);
    setReports(payload?.reports_filed ?? []);
    setFavorites(payload?.favorites ?? []);
    setConversations(payload?.conversations ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const performAction = async () => {
    if (!profile) return;
    if ((modalType === 'suspend' || modalType === 'ban') && !reasonInput.trim()) {
      setActionError('Le motif est obligatoire.');
      return;
    }

    setActionLoading(true);
    setActionError(null);

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
          action: modalType === 'suspend' ? 'suspend_user' : modalType === 'ban' ? 'ban_user' : 'unban_user',
          target_id: profile.id,
          reason: reasonInput.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setActionError(result.error ?? 'Une erreur est survenue.');
        setActionLoading(false);
        return;
      }

      setModalType(null);
      setReasonInput('');
      await loadData();
    } catch {
      setActionError('Erreur réseau.');
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Utilisateur introuvable.</Text>
      </View>
    );
  }

  const isActive = profile.account_status === 'active';
  const isSuspended = profile.account_status === 'suspended';
  const isBanned = profile.account_status === 'banned';

  const profileCity = (() => {
    const address = profile.location_data?.address;
    if (!address) return null;
    const parts = address.split(',');
    if (parts.length >= 2) {
      const cityPart = parts[parts.length - 2].trim();
      const match = cityPart.match(/^\d{4,6}\s+(.+)$/);
      if (match) return match[1].trim();
      return cityPart;
    }
    return null;
  })();

  const eventTypeLabel: Record<string, string> = {
    suspended: 'Suspendu',
    banned: 'Banni',
    unbanned: 'Réactivé',
    warned: 'Averti',
  };

  const eventTypeColor: Record<string, string> = {
    suspended: Colors.suspended,
    banned: Colors.banned,
    unbanned: Colors.successGreen,
    warned: Colors.warning,
  };

  const modalTitle = modalType === 'suspend' ? 'Suspendre 30 jours' : modalType === 'ban' ? 'Bannir définitivement' : 'Réactiver le compte';
  const modalDescription =
    modalType === 'suspend'
      ? "Le compte sera suspendu pendant 30 jours. L'utilisateur recevra un email de notification."
      : modalType === 'ban'
      ? "Le compte sera banni de façon permanente. L'utilisateur recevra un email de notification."
      : "Le compte sera réactivé immédiatement. L'utilisateur recevra un email de confirmation.";

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>@{profile.username ?? 'utilisateur'}</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Identity card */}
        <View style={styles.card}>
          <View style={styles.identityRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {(profile.username ?? profile.email ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.identityInfo}>
              {profile.display_name ? (
                <Text style={styles.legalName}>{profile.display_name}</Text>
              ) : null}
              <View style={styles.identityNameRow}>
                <Text style={styles.username}>@{profile.username ?? 'sans nom'}</Text>
                {profile.role === 'admin' && (
                  <View style={[styles.roleBadge, { backgroundColor: Colors.errorLight }]}>
                    <Text style={[styles.roleBadgeText, { color: Colors.error }]}>Admin</Text>
                  </View>
                )}
                {profile.is_pro && (
                  <View style={[styles.roleBadge, { backgroundColor: Colors.warningLight }]}>
                    <Text style={[styles.roleBadgeText, { color: Colors.warningDark }]}>Pro</Text>
                  </View>
                )}
              </View>
              <Text style={styles.email}>{profile.email ?? '-'}</Text>
              {profile.phone_number && <Text style={styles.metaText}>{profile.phone_number}</Text>}
              {profileCity && <Text style={styles.metaText}>{profileCity}</Text>}
              <Text style={styles.metaText}>
                Inscrit le {new Date(profile.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>
          </View>

          {profile.bio ? (
            <Text style={styles.bio} numberOfLines={3}>{profile.bio}</Text>
          ) : null}

          {profile.business_name ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Entreprise</Text>
              <Text style={styles.infoValue}>{profile.business_name}</Text>
            </View>
          ) : null}

          {profile.siren_number ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>SIREN</Text>
              <Text style={styles.infoValue}>{profile.siren_number}</Text>
            </View>
          ) : null}

          {(() => {
            const cs = deriveConnectStatus({
              account_id: profile.stripe_account_id,
              details_submitted: !!profile.stripe_details_submitted,
              charges_enabled: !!profile.stripe_charges_enabled,
              payouts_enabled: !!profile.stripe_payouts_enabled,
              requirements: profile.stripe_requirements ?? null,
            });
            const colors = connectStatusColors(cs);
            const reqs = profile.stripe_requirements ?? {};
            const pastDue = reqs.past_due ?? [];
            const currentlyDue = reqs.currently_due ?? [];
            const deadline = reqs.current_deadline
              ? new Date(reqs.current_deadline * 1000).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : null;
            return (
              <View style={styles.stripeBlock}>
                <View style={styles.stripeHeader}>
                  <Text style={styles.infoLabel}>Stripe</Text>
                  <View style={[styles.stripeBadge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.stripeBadgeText, { color: colors.fg }]}>
                      {connectStatusLabel(cs)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.stripeDetailLine}>
                  {profile.stripe_account_id ? `ID : ${profile.stripe_account_id}` : 'Non connecté'}
                </Text>
                <Text style={styles.stripeDetailLine}>
                  Charges : {profile.stripe_charges_enabled ? '✓' : '✗'}
                  {'   '}
                  Payouts : {profile.stripe_payouts_enabled ? '✓' : '✗'}
                  {'   '}
                  Soumis : {profile.stripe_details_submitted ? '✓' : '✗'}
                </Text>
                {reqs.disabled_reason ? (
                  <Text style={styles.stripeWarn}>Raison désactivation : {reqs.disabled_reason}</Text>
                ) : null}
                {pastDue.length > 0 ? (
                  <Text style={styles.stripeWarn}>
                    En retard : {pastDue.join(', ')}
                  </Text>
                ) : null}
                {currentlyDue.length > 0 && pastDue.length === 0 ? (
                  <Text style={styles.stripeDetailLine}>
                    À fournir : {currentlyDue.join(', ')}
                  </Text>
                ) : null}
                {deadline ? (
                  <Text style={styles.stripeDetailLine}>Échéance : {deadline}</Text>
                ) : null}
              </View>
            );
          })()}
        </View>

        {/* Account status */}
        <Text style={styles.sectionTitle}>Statut du compte</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <StatusBadge status={profile.account_status} />
            {(isSuspended || isBanned) && profile.ban_reason ? (
              <Text style={styles.banReason} numberOfLines={2}>Motif : {profile.ban_reason}</Text>
            ) : null}
          </View>
          {isSuspended && profile.banned_until && (
            <Text style={styles.banUntil}>
              Suspension jusqu'au {new Date(profile.banned_until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          )}

          {events.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.subSectionTitle}>Historique</Text>
              {events.map((ev) => (
                <View key={ev.id} style={styles.eventRow}>
                  <View style={[styles.eventDot, { backgroundColor: eventTypeColor[ev.event_type] ?? Colors.textMuted }]} />
                  <View style={styles.eventContent}>
                    <Text style={styles.eventType}>{eventTypeLabel[ev.event_type] ?? ev.event_type}</Text>
                    {ev.reason ? <Text style={styles.eventReason} numberOfLines={2}>{ev.reason}</Text> : null}
                    <Text style={styles.eventMeta}>
                      Par @{ev.performed_by_username ?? '?'} · {new Date(ev.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Action buttons */}
        {profile.role !== 'admin' && (
          <>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsCard}>
              {!isSuspended && !isBanned && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.suspendedLight }]}
                  onPress={() => { setModalType('suspend'); setReasonInput(''); setActionError(null); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pause-circle-outline" size={18} color={Colors.suspended} />
                  <Text style={[styles.actionBtnText, { color: Colors.suspended }]}>Suspendre 30 jours</Text>
                </TouchableOpacity>
              )}
              {!isBanned && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.bannedLight }]}
                  onPress={() => { setModalType('ban'); setReasonInput(''); setActionError(null); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="ban-outline" size={18} color={Colors.banned} />
                  <Text style={[styles.actionBtnText, { color: Colors.banned }]}>Bannir définitivement</Text>
                </TouchableOpacity>
              )}
              {(isSuspended || isBanned) && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.successGreenLight }]}
                  onPress={() => { setModalType('unban'); setReasonInput(''); setActionError(null); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.successGreen} />
                  <Text style={[styles.actionBtnText, { color: Colors.successGreen }]}>Réactiver le compte</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Bookings as renter */}
        <Text style={styles.sectionTitle}>Réservations (locataire · {bookingsAsRenter.length})</Text>
        <View style={styles.card}>
          {bookingsAsRenter.length === 0 ? (
            <Text style={styles.emptyText}>Aucune réservation</Text>
          ) : bookingsAsRenter.map((b, i) => (
            <View key={b.id}>
              <View style={styles.listRow}>
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>{b.listing_name ?? '-'}</Text>
                  <Text style={styles.listRowSub}>
                    @{b.other_username ?? '?'} · {new Date(b.start_date).toLocaleDateString('fr-FR')} → {new Date(b.end_date).toLocaleDateString('fr-FR')} · {b.total_price}€
                  </Text>
                </View>
                <StatusBadge status={b.status} small />
              </View>
              {i < bookingsAsRenter.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Bookings as owner */}
        <Text style={styles.sectionTitle}>Réservations (propriétaire · {bookingsAsOwner.length})</Text>
        <View style={styles.card}>
          {bookingsAsOwner.length === 0 ? (
            <Text style={styles.emptyText}>Aucune réservation</Text>
          ) : bookingsAsOwner.map((b, i) => (
            <View key={b.id}>
              <View style={styles.listRow}>
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>{b.listing_name ?? '-'}</Text>
                  <Text style={styles.listRowSub}>
                    @{b.other_username ?? '?'} · {new Date(b.start_date).toLocaleDateString('fr-FR')} · {b.total_price}€
                  </Text>
                </View>
                <StatusBadge status={b.status} small />
              </View>
              {i < bookingsAsOwner.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Listings */}
        <Text style={styles.sectionTitle}>Annonces ({listings.length})</Text>
        <View style={styles.card}>
          {listings.length === 0 ? (
            <Text style={styles.emptyText}>Aucune annonce</Text>
          ) : listings.map((l, i) => (
            <View key={l.id}>
              <View style={styles.listRow}>
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>{l.name}</Text>
                  <Text style={styles.listRowSub}>{l.price}€/jour · {new Date(l.created_at).toLocaleDateString('fr-FR')}</Text>
                </View>
                <StatusBadge status={l.is_active ? 'active' : 'inactive'} small />
              </View>
              {i < listings.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Disputes */}
        <Text style={styles.sectionTitle}>Litiges ({disputes.length})</Text>
        <View style={styles.card}>
          {disputes.length === 0 ? (
            <Text style={styles.emptyText}>Aucun litige</Text>
          ) : disputes.map((d, i) => (
            <View key={d.id}>
              <View style={styles.listRow}>
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>{d.listing_name ?? 'Annonce inconnue'}</Text>
                  <Text style={styles.listRowSub} numberOfLines={2}>{d.description}</Text>
                </View>
                <StatusBadge status={d.status} small />
              </View>
              {i < disputes.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Reports */}
        <Text style={styles.sectionTitle}>Signalements ({reports.length})</Text>
        <View style={styles.card}>
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>Aucun signalement</Text>
          ) : reports.map((r, i) => (
            <View key={r.id}>
              <View style={styles.listRow}>
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>{r.category ?? r.target_type}</Text>
                  {r.description ? <Text style={styles.listRowSub} numberOfLines={2}>{r.description}</Text> : null}
                </View>
                <StatusBadge status={r.status} small />
              </View>
              {i < reports.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Favorites */}
        <Text style={styles.sectionTitle}>Favoris ({favorites.length})</Text>
        <View style={styles.card}>
          {favorites.length === 0 ? (
            <Text style={styles.emptyText}>Aucun favori</Text>
          ) : favorites.map((f, i) => (
            <View key={f.listing_id}>
              <View style={styles.listRow}>
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>{f.listing_name ?? 'Annonce supprimée'}</Text>
                  <Text style={styles.listRowSub}>
                    @{f.owner_username ?? '?'} · ajouté le {new Date(f.saved_at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                {f.is_active === false && <StatusBadge status="inactive" small />}
              </View>
              {i < favorites.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Conversations */}
        <Text style={styles.sectionTitle}>Discussions ({conversations.length})</Text>
        <View style={[styles.card, { marginBottom: 48 }]}>
          {conversations.length === 0 ? (
            <Text style={styles.emptyText}>Aucune discussion</Text>
          ) : conversations.map((c, i) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => router.push(`/chat/${c.id}` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.listRow}>
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle} numberOfLines={1}>{c.listing_name ?? 'Annonce'}</Text>
                  <Text style={styles.listRowSub}>
                    {c.is_requester ? 'Avec @' : 'De @'}{c.other_username ?? '?'} ·{' '}
                    {c.last_message_at
                      ? `dernier msg ${new Date(c.last_message_at).toLocaleDateString('fr-FR')}`
                      : `créée ${new Date(c.created_at).toLocaleDateString('fr-FR')}`}
                  </Text>
                </View>
                <StatusBadge status={c.status} small />
              </View>
              {i < conversations.length - 1 && <View style={styles.rowDivider} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Action Modal */}
      <Modal visible={modalType !== null} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalDescription}>{modalDescription}</Text>

            {modalType !== 'unban' && (
              <>
                <Text style={styles.modalLabel}>Motif *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Saisissez le motif de l'action..."
                  placeholderTextColor={Colors.textMuted}
                  value={reasonInput}
                  onChangeText={setReasonInput}
                  multiline
                  numberOfLines={3}
                  autoFocus
                />
              </>
            )}

            {actionError ? <Text style={styles.modalError}>{actionError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalType(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor:
                      modalType === 'suspend' ? Colors.suspended :
                      modalType === 'ban' ? Colors.banned :
                      Colors.successGreen,
                  },
                ]}
                onPress={performAction}
                activeOpacity={0.8}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirmer</Text>
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
    backgroundColor: Colors.background,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 24 : 56,
    paddingBottom: 16,
    backgroundColor: Colors.background,
    gap: 12,
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
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.3,
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
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 2,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }),
  },
  identityRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight + '60',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.primaryDark,
  },
  identityInfo: {
    flex: 1,
    gap: 3,
  },
  identityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  legalName: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    marginBottom: 2,
  },
  username: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: Colors.textMuted,
  },
  email: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  metaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
  },
  bio: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  infoLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.textMuted,
  },
  infoValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  stripeBlock: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 4,
  },
  stripeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stripeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  stripeBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  stripeDetailLine: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  stripeWarn: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#991B1B',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  banReason: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  banUntil: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.suspended,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 12,
  },
  subSectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  eventContent: {
    flex: 1,
    gap: 2,
  },
  eventType: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  eventReason: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  eventMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  actionsCard: {
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  listRowContent: {
    flex: 1,
    gap: 2,
  },
  listRowTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
  },
  listRowSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
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
    marginBottom: 8,
  },
  modalDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
});
