import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

interface AuditLog {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
  admin: { username: string | null } | null;
}

type ActionFilter = 'all' | 'suspend_user' | 'ban_user' | 'unban_user' | 'flag_transaction';

const ACTION_FILTERS: { key: ActionFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'suspend_user', label: 'Suspensions' },
  { key: 'ban_user', label: 'Bannissements' },
  { key: 'unban_user', label: 'Réactivations' },
  { key: 'flag_transaction', label: 'Signalements' },
];

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  suspend_user: { label: 'Suspension', color: Colors.suspended, bg: Colors.suspendedLight },
  ban_user: { label: 'Bannissement', color: Colors.banned, bg: Colors.bannedLight },
  unban_user: { label: 'Réactivation', color: Colors.successGreen, bg: Colors.successGreenLight },
  flag_transaction: { label: 'Transaction signalée', color: Colors.error, bg: Colors.errorLight },
};

const PAGE_SIZE = 25;

function downloadCSV(csvContent: string, filename: string) {
  if (Platform.OS !== 'web') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [actionFilter]);

  const loadLogs = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('admin_audit_logs')
      .select(
        'id, action, target_type, target_id, details, ip_address, created_at, admin:profiles!admin_audit_logs_admin_id_fkey(username)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    const { data, count } = await query;
    setLogs((data as any) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, actionFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExport = async () => {
    if (Platform.OS !== 'web') return;
    setExportLoading(true);

    let query = supabase
      .from('admin_audit_logs')
      .select('id, action, target_type, target_id, details, ip_address, created_at, admin:profiles!admin_audit_logs_admin_id_fkey(username)')
      .order('created_at', { ascending: false });

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    const { data } = await query;

    const csvContent = [
      'ID,Action,Type cible,ID cible,Admin,Détails,IP,Date',
      ...(data ?? []).map((row: any) =>
        [
          row.id,
          row.action,
          row.target_type,
          row.target_id ?? '',
          row.admin?.username ?? '',
          `"${JSON.stringify(row.details ?? {}).replace(/"/g, '""')}"`,
          row.ip_address ?? '',
          new Date(row.created_at).toLocaleDateString('fr-FR'),
        ].join(',')
      ),
    ].join('\n');

    downloadCSV(csvContent, `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    setExportLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Journal d'audit</Text>
        <View style={styles.headerActions}>
          {Platform.OS === 'web' && (
            <TouchableOpacity onPress={handleExport} style={styles.exportBtn} activeOpacity={0.7} disabled={exportLoading}>
              {exportLoading ? (
                <ActivityIndicator size="small" color={Colors.primaryDark} />
              ) : (
                <Ionicons name="download-outline" size={18} color={Colors.primaryDark} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={loadLogs} style={styles.refreshBtn} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={20} color={Colors.primaryDark} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {ACTION_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, actionFilter === f.key && styles.filterChipActive]}
            onPress={() => setActionFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, actionFilter === f.key && styles.filterChipTextActive]}>
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
          <Text style={styles.count}>{total} entrée{total !== 1 ? 's' : ''}</Text>

          {logs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={40} color={Colors.primaryDark} />
              <Text style={styles.emptyText}>Aucune entrée dans le journal</Text>
            </View>
          ) : logs.map((log) => {
            const actionConfig = ACTION_LABELS[log.action] ?? {
              label: log.action,
              color: Colors.textMuted,
              bg: Colors.borderLight,
            };
            return (
              <TouchableOpacity
                key={log.id}
                style={styles.card}
                onPress={() => setDetailLog(log)}
                activeOpacity={0.75}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.actionBadge, { backgroundColor: actionConfig.bg }]}>
                    <Text style={[styles.actionBadgeText, { color: actionConfig.color }]}>{actionConfig.label}</Text>
                  </View>
                  <Text style={styles.cardDate}>{new Date(log.created_at).toLocaleDateString('fr-FR')}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardAdmin}>Admin : @{(log.admin as any)?.username ?? '?'}</Text>
                  <Text style={styles.cardType}>{log.target_type}</Text>
                </View>
                {log.details?.reason ? (
                  <Text style={styles.cardReason} numberOfLines={1}>Motif : {log.details.reason}</Text>
                ) : null}
                <View style={styles.cardFooter}>
                  <Text style={styles.cardId} numberOfLines={1}>
                    ID : {log.target_id ?? '-'}
                  </Text>
                  <Ionicons name="chevron-forward-outline" size={14} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
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

      <Modal visible={detailLog !== null} transparent animationType="fade" onRequestClose={() => setDetailLog(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détail de l'entrée</Text>
              <TouchableOpacity onPress={() => setDetailLog(null)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close-outline" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            {detailLog && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <DetailRow label="Action" value={ACTION_LABELS[detailLog.action]?.label ?? detailLog.action} />
                <DetailRow label="Type cible" value={detailLog.target_type} />
                <DetailRow label="ID cible" value={detailLog.target_id ?? '-'} />
                <DetailRow label="Admin" value={`@${(detailLog.admin as any)?.username ?? '?'}`} />
                <DetailRow label="Date" value={new Date(detailLog.created_at).toLocaleString('fr-FR')} />
                {detailLog.ip_address ? <DetailRow label="IP" value={detailLog.ip_address} /> : null}
                <Text style={styles.detailLabel}>Détails JSON</Text>
                <View style={styles.jsonBox}>
                  <Text style={styles.jsonText}>{JSON.stringify(detailLog.details ?? {}, null, 2)}</Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    flex: 1,
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  actionBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  cardDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardAdmin: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: Colors.text,
  },
  cardType: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardReason: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardId: {
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
    maxWidth: 480,
    maxHeight: '80%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 10 },
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  detailLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  detailValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  jsonBox: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  jsonText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
