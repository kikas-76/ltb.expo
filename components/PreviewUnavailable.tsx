import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

interface PreviewUnavailableProps {
  title?: string;
  description?: string;
}

export default function PreviewUnavailable({
  title = 'Pas encore disponible',
  description = "Cette page n'est pas encore disponible dans la preview. Elle s'ouvrira au lancement de la marketplace.",
}: PreviewUnavailableProps) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/mes-annonces' as any);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="time-outline" size={36} color={Colors.primaryDark} />
        </View>
        <View style={styles.badge}>
          <Ionicons name="sparkles-outline" size={12} color={Colors.primaryDark} />
          <Text style={styles.badgeText}>Avant-première</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleBack}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={18} color={Colors.white} />
          <Text style={styles.primaryBtnText}>Retour</Text>
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
    maxWidth: 420,
    alignItems: 'center',
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#D4DAC4',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.cardBackground,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: Colors.primaryDark,
    letterSpacing: 0.2,
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
    marginBottom: 28,
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
    minWidth: 180,
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
});
