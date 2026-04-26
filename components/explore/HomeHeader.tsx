import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface HomeHeaderProps {
  username: string | null;
  photoUrl: string | null;
  notificationCount?: number;
}

export default function HomeHeader({ username }: HomeHeaderProps) {
  const firstName = username ?? 'vous';
  const { width } = useWindowDimensions();
  const isSmall = width < 380;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.greetingRow}>
          <Ionicons name="sparkles-outline" size={isSmall ? 15 : 18} color={Colors.primaryDark} />
          <Text style={[styles.greeting, isSmall && styles.greetingSmall]} numberOfLines={1}>
            Bonjour, {firstName}
          </Text>
        </View>
        <Text style={[styles.subtitle, isSmall && styles.subtitleSmall]} numberOfLines={1}>
          Que cherchez-vous aujourd'hui ?
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  left: {
    flex: 1,
    gap: 2,
    marginRight: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greeting: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  greetingSmall: {
    fontSize: 17,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginLeft: 24,
  },
  subtitleSmall: {
    fontSize: 11,
    marginLeft: 21,
  },
});
