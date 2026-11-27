import { Platform } from 'react-native';

// Navigateurs intégrés aux applis (Instagram, Facebook, TikTok…) : Google y
// refuse la connexion (« disallowed_useragent »). Sur ces navigateurs on ne
// propose que l'inscription par email.
const IN_APP_RE = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|TikTok|musical_ly|Bytedance|Snapchat|LinkedInApp|Pinterest|Line\//i;

export function isInAppBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return IN_APP_RE.test(navigator.userAgent || '');
}
