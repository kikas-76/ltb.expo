import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import LoadingBlock from '@/components/LoadingBlock';
import SuspendedScreen from '@/components/SuspendedScreen';
import ConnectionErrorScreen from '@/components/ConnectionErrorScreen';

// Production : pas de journaux verbeux (thread JS, aucune donnée dans les logs
// de l'appareil). console.error reste actif pour le diagnostic.
if (!__DEV__) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
}
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { PRELAUNCH_MODE, PRELAUNCH_ALLOWED_SEGMENTS } from '@/lib/launchConfig';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { UnreadProvider } from '@/contexts/UnreadContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { DeepLinkProvider, useDeepLink } from '@/contexts/DeepLinkContext';
import { Colors } from '@/constants/colors';
import StripeWrapper from '@/components/StripeWrapper';
import ErrorBoundary from '@/components/ErrorBoundary';
import AnimatedSplash from '@/components/AnimatedSplash';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading, profile, profileLoading, profileError, signOut, refreshProfile } = useAuth();
  // URL d'une notification touchée avant que la navigation soit prête (app tuée).
  const [pendingNotificationUrl, setPendingNotificationUrl] = useState<string | null>(null);
  const segments = useSegments();
  const router = useRouter();
  const { setPendingListingId, pendingListingId } = useDeepLink();

  useEffect(() => {
    const handleUrl = async (url: string) => {
      try {
        const isAuthCallback = url.includes('/auth-callback');
        const fragment = url.split('#')[1] ?? '';
        const fragmentParams = new URLSearchParams(fragment);
        const accessToken = fragmentParams.get('access_token');
        const refreshToken = fragmentParams.get('refresh_token');

        if (accessToken && refreshToken) {
          if (isAuthCallback) return;
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          return;
        }

        const parsed = Linking.parse(url);
        const path = parsed.path ?? '';
        const match = path.match(/^listing\/([^/]+)$/) || path.match(/^\/listing\/([^/?#]+)/);
        if (match) {
          // Connecté : expo-router ouvre lui-même la fiche (schéma louetonbien://
          // et Universal Links). Déconnecté : on retient l'annonce pour après.
          if (!session) setPendingListingId(match[1]);
          return;
        }

        const webMatch = url.match(/\/listing\/([^/?#]+)/);
        if (webMatch && !session) {
          setPendingListingId(webMatch[1]);
        }
      } catch {}
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Native only: listening on web makes every internal router.push fire a 'url'
    // event, and our handler re-pushes the same route → infinite loop / Chrome
    // throttling. Web routing is handled by expo-router itself.
    if (Platform.OS !== 'web') {
      const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
      return () => sub.remove();
    }
  }, [session]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // require dynamique : pas de runtime web pour expo-notifications
    const Notifications = require('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const routeFromNotification = (response: any) => {
      const url = response?.notification?.request?.content?.data?.url;
      if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
        // Consommée plus bas, une fois la session et le profil chargés : au
        // lancement depuis une notification, la navigation n'est pas encore montée.
        setPendingNotificationUrl(url);
      }
    };

    // App tuée puis ouverte via une notif : le listener n'a pas encore
    // existé au moment du tap, on rejoue la dernière réponse.
    Notifications.getLastNotificationResponseAsync().then((response: any) => {
      if (response) routeFromNotification(response);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(routeFromNotification);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pendingNotificationUrl || loading || profileLoading) return;
    if (!session) {
      setPendingNotificationUrl(null);
      return;
    }
    if (!profile?.onboarding_completed) return;
    const url = pendingNotificationUrl;
    setPendingNotificationUrl(null);
    const go = (attempt: number) => {
      try {
        router.push(url as any);
      } catch {
        if (attempt < 3) setTimeout(() => go(attempt + 1), 350);
      }
    };
    setTimeout(() => go(0), 50);
  }, [pendingNotificationUrl, loading, profileLoading, session, profile?.onboarding_completed]);

  useEffect(() => {
    if (loading || profileLoading) return;
    // Profil non lisible (réseau) : on n'envoie pas l'utilisateur dans l'onboarding.
    if (session && !profile && profileError) return;

    const seg = segments[0];

    const PUBLIC_ROUTES = new Set([
      undefined,
      '+not-found',
      'login',
      'register',
      'verify-email',
      'email-confirmed',
      'auth-callback',
      'forgot-password',
      'reset-password',
      'legal',
      'book',
      'link-google-account',
    ]);

    const AUTH_ROUTES = new Set([
      'login',
      'register',
      'verify-email',
      'email-confirmed',
      'auth-callback',
      'link-google-account',
    ]);

    const isPublicRoute = PUBLIC_ROUTES.has(seg);
    const isAuthRoute = AUTH_ROUTES.has(seg);
    const isAdminRoute = seg === 'admin';
    const isOnboardingRoute = seg === 'onboarding';
    const isPrivateRoute = !isPublicRoute;

    if (!session) {
      if (isPrivateRoute) {
        router.replace('/');
      }
      return;
    }

    if (isAdminRoute && profile?.role !== 'admin') {
      router.replace('/(tabs)');
      return;
    }

    if (!profile?.onboarding_completed && !isOnboardingRoute) {
      router.replace('/onboarding/profile' as any);
      return;
    }

    // Prelaunch guard: once authenticated + onboarded, only let users
    // reach the allowed routes (account creation, listing creation,
    // wallet, settings, profil). Everything else bounces to mes-annonces.
    // Admins bypass entirely so they can moderate during prelaunch.
    if (PRELAUNCH_MODE && profile?.onboarding_completed && profile?.role !== 'admin') {
      const allowedTabChildren = new Set(['mes-annonces', 'profil']);
      const onAllowedTab = seg === '(tabs)' && allowedTabChildren.has((segments as readonly string[])[1]);
      if (!PRELAUNCH_ALLOWED_SEGMENTS.has(seg) && !onAllowedTab && !isAuthRoute) {
        router.replace('/(tabs)/mes-annonces' as any);
        return;
      }
    }

    // La page de première ouverture (« / », segment undefined) se comporte comme
    // un écran de connexion : session + onboarding terminé → accueil direct.
    const isLandingRoute = seg === undefined;
    if (profile?.onboarding_completed && (isAuthRoute || isLandingRoute)) {
      if (PRELAUNCH_MODE && profile?.role !== 'admin') {
        // Deep links to blocked routes are dropped during prelaunch;
        // otherwise the router would push /listing/... and the guard
        // above would immediately bounce it back, creating a flash.
        if (pendingListingId) setPendingListingId(null);
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem('pending_book_url');
        }
        router.replace('/(tabs)/mes-annonces' as any);
        return;
      }
      if (pendingListingId) {
        const id = pendingListingId;
        setPendingListingId(null);
        router.replace(`/listing/${id}` as any);
      } else if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
        const pendingUrl = window.sessionStorage.getItem('pending_book_url');
        if (pendingUrl) {
          window.sessionStorage.removeItem('pending_book_url');
          // Only honor in-app paths; reject anything that could be parsed as an
          // absolute URL (open-redirect guard).
          const isSafeRelative = pendingUrl.startsWith('/') && !pendingUrl.startsWith('//');
          if (isSafeRelative) {
            router.replace(pendingUrl as any);
            return;
          }
        }
        router.replace('/(tabs)');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [session, loading, profileLoading, segments, profile]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <LoadingBlock fill={false} />
      </View>
    );
  }

  // Compte suspendu ou banni (admin-action) : plus aucun accès à l'app, seulement
  // le support et la déconnexion. La base refuse de toute façon les écritures.
  const suspended =
    !!profile &&
    (profile.account_status === 'banned' ||
      (profile.account_status === 'suspended' &&
        (!profile.banned_until || new Date(profile.banned_until).getTime() > Date.now())));
  if (session && !profile && profileError) {
    return <ConnectionErrorScreen onRetry={refreshProfile} onSignOut={signOut} />;
  }

  if (suspended) {
    return (
      <SuspendedScreen
        status={profile!.account_status!}
        reason={profile!.ban_reason}
        until={profile!.banned_until}
        onSignOut={signOut}
      />
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="email-confirmed" />
        <Stack.Screen name="link-google-account" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="onboarding/profile" />
        <Stack.Screen name="onboarding/address" />
        <Stack.Screen name="onboarding/welcome" />
        <Stack.Screen name="category/[id]" />
        <Stack.Screen name="create-listing" />
        <Stack.Screen name="search" />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="owner/[id]" />
        <Stack.Screen name="edit-address" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="account-settings" />
        <Stack.Screen name="deals" />
        <Stack.Screen name="popular" />
        <Stack.Screen name="recent" />
        <Stack.Screen name="nearby" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="wallet/onboarding" />
        <Stack.Screen name="wallet/manage" />
        <Stack.Screen name="help-center" />
        <Stack.Screen name="help/[category]" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="report" />
        <Stack.Screen name="payment/[booking_id]" />
        <Stack.Screen name="payment-success" />
        <Stack.Screen name="dispute/[booking_id]" />
        <Stack.Screen name="book/[id]" />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="admin/disputes" />
        <Stack.Screen name="admin/reports" />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/bookings" />
        <Stack.Screen name="admin/user/[id]" />
        <Stack.Screen name="admin/analytics" />
        <Stack.Screen name="admin/transactions" />
        <Stack.Screen name="admin/audit" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

/**
 * Splash animé (symbole infini) affiché par-dessus la navigation jusqu'à ce que
 * la session et le profil soient connus, avec une durée minimale pour que
 * l'animation soit vue même quand le cache local répond instantanément.
 */
function BootSplash() {
  const { loading, profileLoading, session } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1700);
    return () => clearTimeout(t);
  }, []);

  const ready = !loading && (!session || !profileLoading);
  return <AnimatedSplash visible={!(ready && minElapsed)} />;
}

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = [
        'button:focus-visible,',
        'a:focus-visible,',
        'input:focus-visible,',
        'textarea:focus-visible,',
        '[role="button"]:focus-visible,',
        '[tabindex]:focus-visible {',
        '  outline: 2px solid #1A6B4A;',
        '  outline-offset: 3px;',
        '  border-radius: 4px;',
        '}',
      ].join('\n');
      document.head.appendChild(style);

      const appleTouchIcon = document.createElement('link');
      appleTouchIcon.rel = 'apple-touch-icon';
      appleTouchIcon.setAttribute('sizes', '180x180');
      appleTouchIcon.href = '/logoLTBwhitoutbaground.png';
      document.head.appendChild(appleTouchIcon);

      const icon32 = document.createElement('link');
      icon32.rel = 'icon';
      icon32.type = 'image/png';
      icon32.setAttribute('sizes', '32x32');
      icon32.href = '/logoLTBwhitoutbaground.png';
      document.head.appendChild(icon32);

      const icon16 = document.createElement('link');
      icon16.rel = 'icon';
      icon16.type = 'image/png';
      icon16.setAttribute('sizes', '16x16');
      icon16.href = '/logoLTBwhitoutbaground.png';
      document.head.appendChild(icon16);

      const ogImage = document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      ogImage.content = '/logoLTBwhitoutbaground.png';
      document.head.appendChild(ogImage);
    }
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': PlusJakartaSans_400Regular,
    'Inter-Medium': PlusJakartaSans_500Medium,
    'Inter-SemiBold': Outfit_600SemiBold,
    'Inter-Bold': Outfit_700Bold,
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <StripeWrapper>
        <DeepLinkProvider>
          <AuthProvider>
            <NotificationsProvider>
            <UnreadProvider>
              <FavoritesProvider>
                <RootNavigator />
                <BootSplash />
              </FavoritesProvider>
            </UnreadProvider>
            </NotificationsProvider>
          </AuthProvider>
        </DeepLinkProvider>
      </StripeWrapper>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
