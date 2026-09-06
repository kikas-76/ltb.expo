// Écran résolu par plateforme hors du dossier app : .native.tsx (SDK Stripe natif)
// et .tsx (web). Un seul fichier de route, donc le bundle web n'embarque jamais
// @stripe/stripe-react-native (ses specs codegen cassent Metro web).
export { default } from '@/components/screens/WalletOnboardingScreen';
