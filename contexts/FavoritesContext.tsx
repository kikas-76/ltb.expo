import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import Snackbar from '@/components/Snackbar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface SnackbarState {
  visible: boolean;
  message: string;
  type: 'favorite' | 'unfavorite' | 'share';
}

interface FavoritesContextType {
  // Reactive: bumped after the favorites set changes; legacy consumers
  // that key off `refreshKey` keep working.
  refreshKey: number;
  triggerRefresh: () => void;
  showSnackbar: (message: string, type: 'favorite' | 'unfavorite' | 'share') => void;
  // New API used by useFavorite to short-circuit per-listing queries.
  isFavorite: (listingId: string) => boolean;
  setFavoriteLocal: (listingId: string, value: boolean) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [refreshKey, setRefreshKey] = useState(0);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    visible: false,
    message: '',
    type: 'favorite',
  });
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());

  // Latest known userId — used to ignore late responses if the user logs out
  // mid-fetch.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const showSnackbar = useCallback(
    (message: string, type: 'favorite' | 'unfavorite' | 'share') => {
      setSnackbar({ visible: true, message, type });
    },
    [],
  );

  const hideSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, visible: false }));
  }, []);

  // Single batch fetch on login or after any toggle. Replaces the
  // per-card SELECT in useFavorite (~18 round-trips on the home screen).
  useEffect(() => {
    if (!userId) {
      setFavoriteIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('saved_listings')
        .select('listing_id')
        .eq('user_id', userId);
      if (cancelled || userIdRef.current !== userId) return;
      const ids = new Set<string>((data ?? []).map((r: any) => r.listing_id));
      setFavoriteIds(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const isFavorite = useCallback(
    (listingId: string) => favoriteIds.has(listingId),
    [favoriteIds],
  );

  const setFavoriteLocal = useCallback((listingId: string, value: boolean) => {
    setFavoriteIds((prev) => {
      if (value === prev.has(listingId)) return prev;
      const next = new Set(prev);
      if (value) next.add(listingId);
      else next.delete(listingId);
      return next;
    });
  }, []);

  const value = useMemo<FavoritesContextType>(
    () => ({
      refreshKey,
      triggerRefresh,
      showSnackbar,
      isFavorite,
      setFavoriteLocal,
    }),
    [refreshKey, triggerRefresh, showSnackbar, isFavorite, setFavoriteLocal],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
      <Snackbar
        visible={snackbar.visible}
        message={snackbar.message}
        type={snackbar.type}
        onHide={hideSnackbar}
      />
    </FavoritesContext.Provider>
  );
}

export function useFavoritesContext() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavoritesContext must be used within FavoritesProvider');
  return ctx;
}
