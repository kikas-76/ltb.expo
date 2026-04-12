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

interface AdminBooking {
  id: string;
  status: string;
  total_price: number;
  deposit_amount: number | null;
  start_date: string;
  end_date: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
  listing: { title: string } | null;
  renter: { username: string | null } | null;
  owner: { username: string | null } | null;
}

const TABS = ['Tous', 'En attente', 'Confirmées', 'Actives', 'Terminées', 'Annulées'];
const TAB_FILTERS: Record<string, string[]> = {
  'Tous': [],
  'En attente': ['pending'],
  'Confirmées': ['confirmed'],
  'Actives': ['active', 'in_progress'],
  'Terminées': ['completed'],
  'Annulées': ['cancelled', 'refused'],
};

export default function AdminBookings() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Tous');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select(`
        id, status, total_price, deposit_amount, start_date, end_date, created_at, stripe_payment_intent_id,
        listing:listings(title),
        renter:profiles!bookings_renter_id_fkey(username),
        owner:profiles!bookings_owner_id_fkey(username)
      `)
      .order('created_at', { ascending: false });
    setBookings((data as any) ?? []);
    setLoading(false);
  };

  const filteredBookings = bookings.filter((b) => {
    const filters = TAB_FILTERS[activeTab];
    if (filters.length === 0) return true;
    return filters.includes(b.status);
  });

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
        <Text style={styles.title}>Réservations</Text>
        <TouchableOpacity onPress={loadBookings} style={styles.refreshBtn} activeOpacity={0.7}>
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
        <Text style={styles.count}>{filteredBookings.length} réservation{filteredBookings.length !== 1 ? 's' : ''}</Text>
        {filteredBookings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={Colors.primaryDark} />
            <Text style={styles.emptyText}>Aucune réservation dans cette catégorie</Text>
          </View>
        ) : filteredBookings.map((b) => (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {b.listing?.title ?? 'Annonce inconnue'}
              </Text>
              <StatusBadge status={b.status} small />
            </View>

            <View style={styles.partiesRow}>
              <View style={styles.partyItem}>
                <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.partyText}>@{b.renter?.username ?? '?'}</Text>
              </View>
              <View style={styles.partySep} />
              <View style={styles.partyItem}>
                <Ionicons name="home-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.partyText}>@{b.owner?.username ?? '?'}</Text>
              </View>
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.detailText}>
                  {new Date(b.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  {' → '}
                  {new Date(b.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="cash-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.detailText}>{b.total_price}€{b.deposit_amount ? ` + ${b.deposit_amount}€ caution` : ''}</Text>
              </View>
            </View>

            {b.stripe_payment_intent_id && (
              <View style={styles.stripeRow}>
                <Ionicons name="card-outline" size={11} color={Colors.textMuted} />
                <Text style={styles.stripeText} numberOfLines={1}>{b.stripe_payment_intent_id}</Text>
              </View>
            )}
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
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  partiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  partyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  partySep: {
    width: 1,
    height: 12,
    backgroundColor: Colors.borderLight,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  stripeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stripeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: Colors.textMuted,
    flex: 1,
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
