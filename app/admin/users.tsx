import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import StatusBadge from '@/components/admin/StatusBadge';

interface AdminUser {
  id: string;
  username: string | null;
  email: string | null;
  is_pro: boolean;
  role: string | null;
  account_status: string;
  stripe_charges_enabled: boolean | null;
  created_at: string;
}

type StatusFilter = 'all' | 'active' | 'suspended' | 'banned';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'suspended', label: 'Suspendus' },
  { key: 'banned', label: 'Bannis' },
];

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [page, search, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);

    let query = supabase
      .from('profiles')
      .select('id, username, email, is_pro, role, account_status, stripe_charges_enabled, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (statusFilter !== 'all') {
      query = query.eq('account_status', statusFilter);
    }

    if (search.trim()) {
      query = query.or(`username.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
    }

    const { data, count } = await query;
    setUsers((data as any) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Utilisateurs</Text>
        <TouchableOpacity onPress={loadUsers} style={styles.refreshBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom ou email..."
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
          <Text style={styles.count}>{total} utilisateur{total !== 1 ? 's' : ''}</Text>

          {users.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={Colors.primaryDark} />
              <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
            </View>
          ) : users.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={styles.card}
              onPress={() => router.push(`/admin/user/${u.id}` as any)}
              activeOpacity={0.75}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>
                  {(u.username ?? u.email ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.username}>@{u.username ?? 'sans nom'}</Text>
                <Text style={styles.email} numberOfLines={1}>{u.email ?? '—'}</Text>
                <Text style={styles.joined}>
                  Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <View style={styles.badgesCol}>
                <StatusBadge status={u.account_status ?? 'active'} small />
                {u.role === 'admin' && (
                  <View style={[styles.badge, { backgroundColor: Colors.errorLight }]}>
                    <Text style={[styles.badgeText, { color: Colors.error }]}>Admin</Text>
                  </View>
                )}
                {u.is_pro && (
                  <View style={[styles.badge, { backgroundColor: Colors.warningLight }]}>
                    <Text style={[styles.badgeText, { color: Colors.warningDark }]}>Pro</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}

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
  searchIcon: { flexShrink: 0 },
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
    }),
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight + '60',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.primaryDark,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  username: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  email: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  joined: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  badgesCol: {
    gap: 4,
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
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
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
  },
  pageBtnTextDisabled: {
    color: Colors.textMuted,
  },
  pageInfo: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
});
