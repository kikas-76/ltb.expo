import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useFavoritesContext } from '@/contexts/FavoritesContext';

export function useFavorite(listingId: string, userId: string | null | undefined, listingName?: string) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const { refreshKey, triggerRefresh, showSnackbar } = useFavoritesContext();

  useEffect(() => {
    if (!userId || !listingId) return;

    const check = async () => {
      const { data } = await supabase
        .from('saved_listings')
        .select('listing_id')
        .eq('user_id', userId)
        .eq('listing_id', listingId)
        .maybeSingle();
      setIsFavorite(!!data);
    };

    check();
  }, [listingId, userId, refreshKey]);

  const toggle = useCallback(async () => {
    if (!userId || loading) return;
    setLoading(true);

    if (isFavorite) {
      await supabase
        .from('saved_listings')
        .delete()
        .eq('user_id', userId)
        .eq('listing_id', listingId);
      setIsFavorite(false);
      showSnackbar('Retiré des favoris', 'unfavorite');
    } else {
      await supabase
        .from('saved_listings')
        .insert({ user_id: userId, listing_id: listingId });
      setIsFavorite(true);
      showSnackbar(listingName ? `"${listingName}" ajouté aux favoris` : 'Ajouté aux favoris', 'favorite');
    }

    triggerRefresh();
    setLoading(false);
  }, [userId, listingId, isFavorite, loading, listingName]);

  return { isFavorite, toggle, loading };
}
