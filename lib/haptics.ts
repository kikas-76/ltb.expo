import { Platform } from 'react-native';

/**
 * Retours haptiques légers, natif uniquement (no-op sur le web).
 * - tap : sélection / favori / envoi de message
 * - confirm : action importante (réserver, publier)
 * - success / error : fin d'une opération
 */
function mod(): typeof import('expo-haptics') | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-haptics');
  } catch {
    return null;
  }
}

export const haptics = {
  tap() {
    mod()?.impactAsync(mod()!.ImpactFeedbackStyle.Light).catch(() => {});
  },
  confirm() {
    mod()?.impactAsync(mod()!.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  success() {
    mod()?.notificationAsync(mod()!.NotificationFeedbackType.Success).catch(() => {});
  },
  error() {
    mod()?.notificationAsync(mod()!.NotificationFeedbackType.Error).catch(() => {});
  },
  selection() {
    mod()?.selectionAsync().catch(() => {});
  },
};
