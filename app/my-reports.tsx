import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

interface MyReport {
  id: string;
  status: 'pending' | 'seen' | 'rejected' | 'resolved';
  category: string;
  description: string | null;
  target_type: 'listing' | 'conversation';
  target_id: string;
  created_at: string;
}

// Mirror the labels used in app/report.tsx so the user sees the same
// French strings they picked when filing the report.
const CATEGORY_LABELS: Record<string, string> = {
  fraud: 'Arnaque / Fraude',
  inappropriate_content: 'Contenu inapproprié',
  spam: 'Spam',
  counterfeit: 'Contrefaçon',
  dangerous: 'Objet dangereux',
  harassment: 'Harcèlement',
  no_show: 'Absence / No-show',
  other: 'Autre',
};

const STATUS_LABELS: Record<MyReport['status'], { label: string; color: string }> = {
  pending: { label: 'En attente', color: Colors.warningDark },
  seen: { label: 'En cours d’examen', color: Colors.info },
  rejected: { label: 'Rejeté', color: Colors.textMuted },
  resolved: { label: 'Résolu', color: Colors.successGreen },
};

export default function MyReportsScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    // RLS already restricts SELECT to reporter_id = auth.uid(), so an
    // explicit .eq is defence-in-depth — also lets us drop the index
    // scan onto a single user.
    const { data } = await supabase
      .from('reports')
      .select('id, status, category, description, target_type, target_id, created_at')
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false });

    setReports((data as MyReport[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Mes signalements</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          {reports.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="flag-outline" size={40} color={Colors.primaryDark} />
              <Text style={styles.emptyTitle}>Aucun signalement</Text>
              <Text style={styles.emptyText}>
                Vous n'avez encore signalé aucune annonce ou conversation.
              </Text>
            </View>
          ) : (
            reports.map((r) => {
              const status = STATUS_LABELS[r.status];
              const targetLabel = r.target_type === 'listing' ? 'Annonce' : 'Conversation';
              return (
                <View key={r.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.tagRow}>
                      <View style={styles.targetTag}>
                        <Text style={styles.targetTagText}>{targetLabel}</Text>
                      </View>
                      <View style={styles.categoryTag}>
                        <Text style={styles.categoryTagText}>
                          {CATEGORY_LABELS[r.category] ?? r.category}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: status.color + '18' }]}>
                      <Text style={[styles.statusPillText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  {r.description ? (
                    <Text style={styles.description} numberOfLines={3}>
                      {r.description}
                    </Text>
                  ) : null}

                  <Text style={styles.meta}>
                    {new Date(r.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 24 : 56,
    paddingBottom: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { padding: 20, gap: 12, paddingBottom: 40 },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tagRow: { flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' },
  targetTag: {
    backgroundColor: Colors.primaryLight + '40',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  targetTagText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.primaryDark,
  },
  categoryTag: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryTagText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  meta: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
});
