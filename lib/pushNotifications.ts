import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

// require dynamique : expo-notifications / expo-device n'ont pas de
// runtime web et ne doivent pas finir dans le bundle web.
function nativeModules() {
  const Device = require('expo-device');
  const Notifications = require('expo-notifications');
  return { Device, Notifications };
}

function getProjectId(): string | null {
  return Constants?.expoConfig?.extra?.eas?.projectId ?? null;
}

export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { Device, Notifications } = nativeModules();
    if (!Device.isDevice) return; // les simulateurs ne reçoivent pas de push

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const res = await Notifications.requestPermissionsAsync();
      status = res.status;
    }
    if (status !== 'granted') return;

    const projectId = getProjectId();
    if (!projectId) return;

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token: string | undefined = tokenRes?.data;
    if (!token) return;

    // RPC SECURITY DEFINER : réassigne aussi un token qui appartenait à
    // un autre compte (changement d'utilisateur sur le même appareil),
    // ce que RLS ne permettrait pas en upsert direct.
    await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS,
    });
  } catch (e) {
    console.error('push registration failed:', e);
  }
}

// À appeler AVANT supabase.auth.signOut() : la suppression passe par RLS
// et nécessite encore la session.
export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { Device, Notifications } = nativeModules();
    if (!Device.isDevice) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = getProjectId();
    if (!projectId) return;

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    if (tokenRes?.data) {
      await supabase.from('push_tokens').delete().eq('token', tokenRes.data);
    }
  } catch {
    // best-effort : un token orphelin sera purgé au premier DeviceNotRegistered
  }
}
