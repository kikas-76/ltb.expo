import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Décalage vertical d'un en-tête d'écran (bouton retour, logo…).
 * Natif : zone sûre (encoche / Dynamic Island) + marge, pour que le bouton
 * retour soit toujours entièrement sous la barre d'état et facile à atteindre.
 * Web : espacement fixe équivalent à l'ancien `paddingTop: 60`.
 */
export function useHeaderTop(extra = 12): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === 'web') return 60;
  return insets.top + extra;
}
