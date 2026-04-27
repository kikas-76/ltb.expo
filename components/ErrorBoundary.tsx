import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Hook explicite — branchement Sentry / edge function plus tard
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null });
    try {
      router.replace('/(tabs)' as any);
    } catch {
      try {
        router.replace('/' as any);
      } catch {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <FallbackUI
        error={this.state.error}
        onRetry={this.handleRetry}
        onHome={this.handleHome}
      />
    );
  }
}

interface FallbackUIProps {
  error: Error | null;
  onRetry: () => void;
  onHome: () => void;
}

function FallbackUI({ error, onRetry, onHome }: FallbackUIProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
        </View>

        <Text style={styles.title}>Une erreur est survenue</Text>
        <Text style={styles.description}>
          Quelque chose s&apos;est mal passé. Tu peux réessayer ou revenir à l&apos;accueil.
        </Text>

        {__DEV__ && error ? (
          <ScrollView style={styles.devBox} contentContainerStyle={styles.devBoxContent}>
            <Text style={styles.devLabel}>{error.name || 'Error'}</Text>
            <Text style={styles.devMessage}>{error.message}</Text>
            {error.stack ? <Text style={styles.devStack}>{error.stack}</Text> : null}
          </ScrollView>
        ) : null}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onRetry}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={18} color={Colors.white} />
          <Text style={styles.primaryBtnText}>Réessayer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onHome}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>Retour à l&apos;accueil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F4C7C5',
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  devBox: {
    width: '100%',
    maxHeight: 220,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  devBoxContent: {
    padding: 12,
  },
  devLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.error,
    marginBottom: 4,
  },
  devMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.text,
    marginBottom: 8,
  },
  devStack: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryDark,
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 28,
    minWidth: 200,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10 },
      android: { elevation: 4 },
      web: { boxShadow: `0 4px 16px ${Colors.primaryDark}44` } as any,
    }),
  },
  primaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    height: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
});
