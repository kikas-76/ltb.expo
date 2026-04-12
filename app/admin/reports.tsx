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

interface Report {
  id: string;
  status: string;
  category: string;
  description: string;
  target_type: string;
  target_id: string;
  created_at: string;
  reporter: { username: string | null; email: string | null } | null;
}

const TABS = ['Tous', 'En attente', 'Vus', 'Rejetés'];
const TAB_FILTERS: Record<string, string[]> = {
  'Tous': [],
  'En attente': ['pending'],
  'Vus': ['seen'],
  'Rejetés': ['rejected'],
};

const CATEGORY_LABELS: Record<string, string> = {
  spam: 'Spam',
  scam: 'Arnaque',
  inappropriate: 'Contenu inapproprié',
  fake: 'Annonce fausse',
  harassment: 'Harcèlement',
  other: 'Autre',
};

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Tous');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select('id, status, category, description, target_type, target_id, created_at, reporter:profiles!reports_reporter_id_fkey(username, email)')
      .order('created_at', { ascending: false });
    setReports((data as any) ?? []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + '_' + status);
    await supabase.from('reports').update({ status }).eq('id', id);
    await loadReports();
    setActionLoading(null);
  };

  const filteredReports = reports.filter((r) => {
    const filters = TAB_FILTERS[activeTab];
    if (filters.length === 0) return true;
    return filters.includes(r.status);
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
        <Text style={styles.title}>Signalements</Text>
        <TouchableOpacity onPress={loadReports} style={styles.refreshBtn} activeOpacity={0.7}>
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
        {filteredReports.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={40} color={Colors.primaryDark} />
            <Text style={styles.emptyText}>Aucun signalement dans cette catégorie</Text>
          </View>
        ) : filteredReports.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.categoryRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{CATEGORY_LABELS[r.category] ?? r.category}</Text>
                  </View>
                  <Text style={styles.targetType}>{r.target_type === 'listing' ? 'Annonce' : 'Utilisateur'}</Text>
                </View>
                <Text style={styles.cardMeta}>
                  Par @{r.reporter?.username ?? '?'} · {new Date(r.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <StatusBadge status={r.status} />
            </View>

            <Text style={styles.description} numberOfLines={3}>{r.description}</Text>

            {r.target_type === 'listing' && (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => router.push(`/listing/${r.target_id}` as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={13} color={Colors.info} />
                <Text style={styles.linkText}>Voir l'annonce signalée</Text>
              </TouchableOpacity>
            )}
            {r.target_type === 'user' && (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => router.push(`/owner/${r.target_id}` as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={13} color={Colors.info} />
                <Text style={styles.linkText}>Voir le profil signalé</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actions}>
              {r.status === 'pending' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.primarySurface, borderColor: Colors.primaryLight }]}
                  onPress={() => updateStatus(r.id, 'seen')}
                  disabled={!!actionLoading}
                  activeOpacity={0.7}
                >
                  {actionLoading === r.id + '_seen' ? (
                    <ActivityIndicator size="small" color={Colors.primaryDark} />
                  ) : (
                    <Text style={[styles.actionBtnText, { color: Colors.primaryDark }]}>Marquer vu</Text>
                  )}
                </TouchableOpacity>
              )}
              {r.status !== 'rejected' && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.borderLight, borderColor: Colors.border }]}
                  onPress={() => updateStatus(r.id, 'rejected')}
                  disabled={!!actionLoading}
                  activeOpacity={0.7}
                >
                  {actionLoading === r.id + '_rejected' ? (
                    <ActivityIndicator size="small" color={Colors.textSecondary} />
                  ) : (
                    <Text style={[styles.actionBtnText, { color: Colors.textSecondary }]}>Rejeter</Text>
                  )}
                </TouchableOpacity>
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
    gap: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.warningDark,
  },
  targetType: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  linkText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: Colors.info,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
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
