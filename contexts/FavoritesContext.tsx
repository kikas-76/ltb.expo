import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Snackbar from '@/components/Snackbar';

interface SnackbarState {
  visible: boolean;
  message: string;
  type: 'favorite' | 'unfavorite' | 'share';
}

interface FavoritesContextType {
  refreshKey: number;
  triggerRefresh: () => void;
  showSnackbar: (message: string, type: 'favorite' | 'unfavorite' | 'share') => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ visible: false, message: '', type: 'favorite' });

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const showSnackbar = useCallback((message: string, type: 'favorite' | 'unfavorite' | 'share') => {
    setSnackbar({ visible: true, message, type });
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, visible: false }));
  }, []);

  return (
    <FavoritesContext.Provider value={{ refreshKey, triggerRefresh, showSnackbar }}>
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
