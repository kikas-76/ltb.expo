import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
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
        const fragment = url.split('#')[1] ?? '';
        const fragmentParams = new URLSearchParams(fragment);
        const accessToken = fragmentParams.get('access_token');
        const refreshToken = fragmentParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { supabase: sb } = await import('@/lib/supabase');
          await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          return;
        }

        const parsed = Linking.parse(url);
        const path = parsed.path ?? '';
        const match = path.match(/^listing\/([^/]+)$/);
        if (match) {
          const listingId = match[1];
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
    const run = async () => {
      if (loading || profileLoading) return;

      const inAuthGroup = segments[0] === '(tabs)';
      const inOnboarding = segments[0] === 'onboarding';
      const inCategory = segments[0] === 'category';
      const inCreateListing = segments[0] === 'create-listing';
      const inSearch = segments[0] === 'search';
      const inListing = segments[0] === 'listing';
      const inOwner = segments[0] === 'owner';
      const inEditAddress = segments[0] === 'edit-address';
      const inChat = segments[0] === 'chat';
      const inFavorites = segments[0] === 'favorites';
      const inAccountSettings = segments[0] === 'account-settings';
      const inDeals = segments[0] === 'deals';
      const inPopular = segments[0] === 'popular';
      const inRecent = segments[0] === 'recent';
      const inNearby = segments[0] === 'nearby';
      const inWallet = segments[0] === 'wallet';
      const inHelpCenter = segments[0] === 'help-center';
      const inHelp = segments[0] === 'help';
      const inLegal = segments[0] === 'legal';
      const inReport = segments[0] === 'report';
      const inPayment = segments[0] === 'payment';
      const inPaymentSuccess = segments[0] === 'payment-success';
      const inDispute = segments[0] === 'dispute';

      const inLogin = segments[0] === 'login';
      const inRegister = segments[0] === 'register';

      if (!session && inAuthGroup) {
        router.replace('/');
      } else if (session && !inOnboarding && !inLogin && !inRegister && segments[0] !== undefined) {
        if (!profile?.username) {
          router.replace('/onboarding/profile' as any);
        } else if (!inAuthGroup && !inCategory && !inCreateListing && !inSearch && !inListing && !inOwner && !inEditAddress && !inChat && !inFavorites && !inAccountSettings && !inDeals && !inPopular && !inRecent && !inNearby && !inWallet && !inHelpCenter && !inHelp && !inLegal && !inReport && !inPayment && !inPaymentSuccess && !inDispute) {
          if (pendingListingId) {
            const id = pendingListingId;
            setPendingListingId(null);
            router.replace(`/listing/${id}` as any);
          } else {
            router.replace('/(tabs)');
          }
        }
      }
    };
    run();
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
        <Stack.Screen name="help-center" />
        <Stack.Screen name="help/[category]" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="report" />
        <Stack.Screen name="payment/[booking_id]" />
        <Stack.Screen name="payment-success" />
        <Stack.Screen name="dispute/[booking_id]" />
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
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
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
