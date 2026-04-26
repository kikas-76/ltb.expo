import { StripeProvider } from '@stripe/stripe-react-native';
import type { ReactElement } from 'react';

export default function StripeWrapper({ children }: { children: React.ReactNode }) {
  // StripeProvider's children prop is typed narrower than React.ReactNode;
  // the cast keeps the wrapper's public surface unchanged for callers.
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
      merchantIdentifier="merchant.com.louetonbien"
      urlScheme="louetonbien"
    >
      {children as ReactElement}
    </StripeProvider>
  );
}
