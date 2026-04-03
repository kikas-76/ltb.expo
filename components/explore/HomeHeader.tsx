import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface HomeHeaderProps {
  username: string | null;
  photoUrl: string | null;
  notificationCount?: number;
}

export default function HomeHeader({ username, notificationCount = 0 }: HomeHeaderProps) {
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

      <TouchableOpacity style={styles.bellWrapper} activeOpacity={0.7}>
        <Ionicons name="notifications-outline" size={20} color={Colors.text} />
        {notificationCount > 0 && (
          <View style={styles.badge} />
        )}
      </TouchableOpacity>
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
  bellWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flexShrink: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    }),
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E74C3C',
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
});
