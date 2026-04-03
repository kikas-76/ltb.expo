import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProBadgeProps {
  size?: 'sm' | 'md';
}

export default function ProBadge({ size = 'md' }: ProBadgeProps) {
  const isSmall = size === 'sm';
  return (
    <View style={[styles.badge, isSmall && styles.badgeSm]}>
      <Ionicons name="checkmark-circle" size={isSmall ? 10 : 12} color="#fff" />
      <Text style={[styles.text, isSmall && styles.textSm]}>Pro</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#3A6BBF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeSm: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  text: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 9,
  },
});
