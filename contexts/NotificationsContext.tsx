import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsContextValue {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * Centre de notifications : liste, compteur de non-lus, mise à jour en direct
 * (Supabase Realtime sur la table notifications) et pastille sur l'icône iOS.
 * Le serveur écrit une ligne pour chaque notification envoyée (_shared/push.ts).
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const unread = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, data, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data as AppNotification[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          if (payload.eventType === 'INSERT') {
            setItems((prev) => [row, ...prev.filter((n) => n.id !== row.id)]);
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) => prev.map((n) => (n.id === row.id ? { ...n, ...row } : n)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setItems((prev) => prev.filter((n) => n.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Pastille sur l'icône de l'app = nombre de non-lus.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      const Notifications = require('expo-notifications');
      Notifications.setBadgeCountAsync(unread).catch(() => {});
    } catch {}
  }, [unread]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  }, [userId]);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  }, []);

  const value = useMemo(
    () => ({ items, unread, loading, refresh, markRead, markAllRead, remove }),
    [items, unread, loading, refresh, markRead, markAllRead, remove],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
