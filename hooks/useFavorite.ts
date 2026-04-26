import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useFavoritesContext } from '@/contexts/FavoritesContext';

// Reads from the FavoritesContext cache (one batch SELECT per session)
// instead of doing a per-card SELECT — see P2-3 in the audit.
export function useFavorite(
  listingId: string,
  userId: string | null | undefined,
  listingName?: string,
) {
  const [loading, setLoading] = useState(false);
  const { isFavorite: isFavInCtx, setFavoriteLocal, showSnackbar, triggerRefresh } =
    useFavoritesContext();

  const isFavorite = isFavInCtx(listingId);

  const toggle = useCallback(async () => {
    if (!userId || loading) return;
    setLoading(true);

    // Optimistic update so the UI flips immediately.
    const next = !isFavorite;
    setFavoriteLocal(listingId, next);

    if (next) {
      const { error } = await supabase
        .from('saved_listings')
        .insert({ user_id: userId, listing_id: listingId });
      if (error) {
        setFavoriteLocal(listingId, false);
      } else {
        showSnackbar(
          listingName ? `"${listingName}" ajouté aux favoris` : 'Ajouté aux favoris',
          'favorite',
        );
      }
    } else {
      const { error } = await supabase
        .from('saved_listings')
        .delete()
        .eq('user_id', userId)
        .eq('listing_id', listingId);
      if (error) {
        setFavoriteLocal(listingId, true);
      } else {
        showSnackbar('Retiré des favoris', 'unfavorite');
      }
    }

    // Reconcile any lists that key off refreshKey (e.g. /favorites screen).
    triggerRefresh();
    setLoading(false);
  }, [userId, listingId, isFavorite, loading, listingName, setFavoriteLocal, showSnackbar, triggerRefresh]);

  return { isFavorite, toggle, loading };
}
