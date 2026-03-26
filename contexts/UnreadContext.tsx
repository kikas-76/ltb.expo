import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface UnreadContextType {
  hasIncomingRequests: boolean;
  incomingRequestCount: number;
  refresh: () => Promise<void>;
}

const UnreadContext = createContext<UnreadContextType>({
  hasIncomingRequests: false,
  incomingRequestCount: 0,
  refresh: async () => {},
});

export function UnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setIncomingRequestCount(0);
      return;
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('id, owner_id, requester_id, status, chat_messages(id, sender_id, is_read)')
      .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`);

    if (error || !data) return;

    let count = 0;
    for (const conv of data as any[]) {
      if ((conv.status ?? 'pending') !== 'pending') continue;
      const msgs: any[] = conv.chat_messages ?? [];
      const unread = msgs.filter(
        (m) => m.sender_id !== null && m.sender_id !== user.id && !m.is_read
      );
      if (unread.length > 0) count++;
    }

    setIncomingRequestCount(count);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('unread-watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => { refresh(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => { refresh(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, refresh]);

  return (
    <UnreadContext.Provider
      value={{
        hasIncomingRequests: incomingRequestCount > 0,
        incomingRequestCount,
        refresh,
      }}
    >
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
