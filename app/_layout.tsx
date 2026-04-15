import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
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
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { UnreadProvider } from '@/contexts/UnreadContext';
import { DeepLinkProvider, useDeepLink } from '@/contexts/DeepLinkContext';
import { Colors } from '@/constants/colors';
import StripeWrapper from '@/components/StripeWrapper';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading, profile, profileLoading } = useAuth();
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
          const { supabase: sb } = await import('@/lib/supabase');
          await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          return;
        }

        const parsed = Linking.parse(url);
        const path = parsed.path ?? '';
        const match = path.match(/^listing\/([^/]+)$/) || path.match(/^\/listing\/([^/?#]+)/);
        if (match) {
          const listingId = match[1];
          setPendingListingId(listingId);
          if (session) {
            router.push(`/listing/${listingId}` as any);
          }
          return;
        }

        const webMatch = url.match(/\/listing\/([^/?#]+)/);
        if (webMatch) {
          const listingId = webMatch[1];
          setPendingListingId(listingId);
          if (session) {
            router.push(`/listing/${listingId}` as any);
          }
        }
      } catch {}
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [session]);

  useEffect(() => {
    if (loading || profileLoading) return;

    const seg = segments[0];

    const PUBLIC_ROUTES = new Set([
      undefined,
      '+not-found',
      'login',
      'register',
      'verify-email',
      'email-confirmed',
      'auth-callback',
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

    if (profile?.onboarding_completed && isAuthRoute) {
      if (pendingListingId) {
        const id = pendingListingId;
        setPendingListingId(null);
        router.replace(`/listing/${id}` as any);
      } else if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
        const pendingUrl = window.sessionStorage.getItem('pending_book_url');
        if (pendingUrl) {
          window.sessionStorage.removeItem('pending_book_url');
          router.replace(pendingUrl as any);
          return;
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
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
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
        <Stack.Screen name="chat/[id]" options={{ gestureEnabled: false }} />
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

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = '*, *:focus { outline: none !important; } input:focus, textarea:focus { outline: none !important; box-shadow: none !important; }';
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
    <StripeWrapper>
      <DeepLinkProvider>
        <AuthProvider>
          <UnreadProvider>
            <FavoritesProvider>
              <RootNavigator />
            </FavoritesProvider>
          </UnreadProvider>
        </AuthProvider>
      </DeepLinkProvider>
    </StripeWrapper>
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
