import { StripeProvider } from '@stripe/stripe-react-native';

export default function StripeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
      merchantIdentifier="merchant.com.louetonbien"
      urlScheme="louetonbien"
    >
      {children}
    </StripeProvider>
  );
}
