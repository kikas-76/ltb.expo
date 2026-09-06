import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useNotifications, type AppNotification } from '@/contexts/NotificationsContext';
import { TabIcon, type TabIconName } from '@/components/TabIcon';
import EmptyState from '@/components/EmptyState';
import { haptics } from '@/lib/haptics';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'hier';
  if (d < 7) return `il y a ${d} jours`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function iconFor(type: string): { name: TabIconName; tint: string; ink: string } {
  if (type === 'new_message') return { name: 'inbox', tint: '#D8E6F2', ink: '#2F5C86' };
  if (type.startsWith('reminder')) return { name: 'bell', tint: '#FBEBCB', ink: '#A66A1F' };
  if (type.includes('payment') || type.includes('deposit')) return { name: 'listings', tint: '#E4EBD3', ink: '#3E5A2B' };
  return { name: 'listings', tint: '#D9EBE4', ink: '#2E6B57' };
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { items, unread, loading, refresh, markRead, markAllRead } = useNotifications();

  const open = async (n: AppNotification) => {
    haptics.selection();
    if (!n.is_read) markRead(n.id);
    const url = n.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as any);
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const icon = iconFor(item.type);
    return (
      <TouchableOpacity style={[styles.row, !item.is_read && styles.rowUnread]} onPress={() => open(item)} activeOpacity={0.8}>
        <View style={[styles.iconWrap, { backgroundColor: icon.tint }]}>
          <TabIcon name={icon.name} size={22} color={icon.ink} active />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTitleLine}>
            <Text style={[styles.rowTitle, !item.is_read && styles.rowTitleUnread]} numberOfLines={1}>{item.title}</Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          {item.body ? <Text style={styles.rowText} numberOfLines={3}>{item.body}</Text> : null}
          <Text style={styles.rowTime}>{relativeTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any))} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unread > 0 ? (
          <TouchableOpacity onPress={() => { haptics.tap(); markAllRead(); }} style={styles.readAllBtn} activeOpacity={0.7}>
            <Text style={styles.readAllText}>Tout lire</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty, { paddingBottom: insets.bottom + 24 }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              illustration="chat"
              title="Aucune notification pour l'instant"
              subtitle="Demandes, messages, paiements et rappels de vos locations arriveront ici."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7E3D5',
  },
  headerTitle: { flex: 1, fontFamily: 'Inter-Bold', fontSize: 17, color: Colors.text, textAlign: 'center' },
  readAllBtn: { width: 64, alignItems: 'flex-end' },
  readAllText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.primaryDark },
  list: { paddingHorizontal: 16, paddingTop: 6 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  separator: { height: 8 },
  row: {
    flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: '#EDEAE0',
  },
  rowUnread: { borderColor: '#D9E2C8', backgroundColor: '#FBFAF4' },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 3 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.text },
  rowTitleUnread: { fontFamily: 'Inter-Bold' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  rowText: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  rowTime: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
