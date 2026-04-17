import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import StatusBadge from '@/components/admin/StatusBadge';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

interface Dispute {
  id: string;
  status: string;
  description: string;
  created_at: string;
  photo_urls: string[] | null;
  reporter: { username: string | null; email: string | null } | null;
  booking: {
    id: string;
    stripe_payment_intent_id: string | null;
    deposit_amount: number | null;
    total_price: number;
    listing: { name: string } | null;
    renter: { username: string | null } | null;
    owner: { username: string | null } | null;
  } | null;
}

const TABS = ['Tous', 'Ouverts', 'En cours', 'Résolus'];
const TAB_FILTERS: Record<string, string[]> = {
  'Tous': [],
  'Ouverts': ['open'],
  'En cours': ['under_review'],
  'Résolus': ['resolved'],
};

export default function AdminDisputes() {
  const { session } = useAuth();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Tous');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('disputes')
      .select(`
        id, status, description, created_at, photo_urls,
        reporter:profiles!disputes_reporter_id_fkey(username, email),
        booking:bookings(
          id, stripe_payment_intent_id, deposit_amount, total_price,
          listing:listings(name),
          renter:profiles!bookings_renter_id_fkey(username),
          owner:profiles!bookings_owner_id_fkey(username)
        )
      `)
      .order('created_at', { ascending: false });
    setDisputes((data as any) ?? []);
    setLoading(false);
  };

  const filteredDisputes = disputes.filter((d) => {
    const filters = TAB_FILTERS[activeTab];
    if (filters.length === 0) return true;
    return filters.includes(d.status);
  });

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + '_status');
    await supabase.from('disputes').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    await loadDisputes();
    setActionLoading(null);
  };

  const callManageDeposit = async (bookingId: string, action: 'capture' | 'release') => {
    if (!session) return;
    setActionLoading(bookingId + '_' + action);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ booking_id: bookingId, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (Platform.OS === 'web') {
          window.alert(json.error ?? 'Une erreur est survenue');
        } else {
          Alert.alert('Erreur', json.error ?? 'Une erreur est survenue');
        }
      } else {
        await loadDisputes();
      }
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Erreur réseau');
      } else {
        Alert.alert('Erreur réseau');
      }
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Litiges</Text>
        <TouchableOpacity onPress={loadDisputes} style={styles.refreshBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredDisputes.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={40} color={Colors.primaryDark} />
            <Text style={styles.emptyText}>Aucun litige dans cette catégorie</Text>
          </View>
        ) : filteredDisputes.map((d) => (
          <View key={d.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {d.booking?.listing?.name ?? 'Annonce inconnue'}
                </Text>
                <Text style={styles.cardMeta}>
                  Signalé par @{d.reporter?.username ?? '?'} · {new Date(d.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <StatusBadge status={d.status} />
            </View>

            <Text style={styles.description} numberOfLines={3}>{d.description}</Text>

            <View style={styles.partiesRow}>
              <View style={styles.partyItem}>
                <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.partyText}>Locataire: @{d.booking?.renter?.username ?? '?'}</Text>
              </View>
              <View style={styles.partyItem}>
                <Ionicons name="home-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.partyText}>Propriétaire: @{d.booking?.owner?.username ?? '?'}</Text>
              </View>
            </View>

            {d.booking?.deposit_amount && (
              <Text style={styles.depositText}>
                Caution: {d.booking.deposit_amount}€
              </Text>
            )}

            <View style={styles.actions}>
              {d.status === 'open' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => updateStatus(d.id, 'under_review')}
                  disabled={!!actionLoading}
                  activeOpacity={0.7}
                >
                  {actionLoading === d.id + '_status' ? (
                    <ActivityIndicator size="small" color={Colors.info} />
                  ) : (
                    <Text style={[styles.actionBtnText, { color: Colors.info }]}>Prendre en charge</Text>
                  )}
                </TouchableOpacity>
              )}
              {d.status !== 'resolved' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => updateStatus(d.id, 'resolved')}
                  disabled={!!actionLoading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionBtnText, { color: Colors.primaryDark }]}>Marquer résolu</Text>
                </TouchableOpacity>
              )}
              {d.booking?.id && d.booking?.stripe_payment_intent_id && d.booking.deposit_amount && (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.error + '15', borderColor: Colors.error + '40' }]}
                    onPress={() => callManageDeposit(d.booking!.id, 'capture')}
                    disabled={!!actionLoading}
                    activeOpacity={0.7}
                  >
                    {actionLoading === d.booking.id + '_capture' ? (
                      <ActivityIndicator size="small" color={Colors.error} />
                    ) : (
                      <Text style={[styles.actionBtnText, { color: Colors.error }]}>Capturer caution</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.primarySurface, borderColor: Colors.primaryLight }]}
                    onPress={() => callManageDeposit(d.booking!.id, 'release')}
                    disabled={!!actionLoading}
                    activeOpacity={0.7}
                  >
                    {actionLoading === d.booking.id + '_release' ? (
                      <ActivityIndicator size="small" color={Colors.primaryDark} />
                    ) : (
                      <Text style={[styles.actionBtnText, { color: Colors.primaryDark }]}>Libérer caution</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
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
  tabsScroll: {
    flexGrow: 0,
    backgroundColor: Colors.background,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tabActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 12,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  cardMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  partiesRow: {
    gap: 4,
    marginBottom: 8,
  },
  partyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  partyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  depositText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.warning,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.white,
  },
  actionBtnSecondary: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primaryLight,
  },
  actionBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
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
});
