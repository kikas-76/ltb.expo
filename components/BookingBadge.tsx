import { View, Text, StyleSheet } from 'react-native';

interface BadgeConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
  icon: string;
}

export function getBookingBadge(status: string): BadgeConfig {
  switch (status) {
    case 'pending':
      return { label: 'En attente', backgroundColor: '#FFF3CD', textColor: '#856404', icon: '⏳' };
    case 'accepted':
      return { label: 'Acceptée', backgroundColor: '#D4EDDA', textColor: '#155724', icon: '✓' };
    case 'active':
      return { label: 'Prêt pour la remise', backgroundColor: '#1B4332', textColor: '#FFFFFF', icon: '🤝' };
    case 'pending_return':
      return { label: 'Retour en cours', backgroundColor: '#CCE5FF', textColor: '#004085', icon: '↩️' };
    case 'completed':
      return { label: 'Terminée', backgroundColor: '#E2E3E5', textColor: '#383D41', icon: '✓' };
    case 'rejected':
      return { label: 'Refusée', backgroundColor: '#F8D7DA', textColor: '#721C24', icon: '✕' };
    case 'refused':
      return { label: 'Refusée', backgroundColor: '#F8D7DA', textColor: '#721C24', icon: '✕' };
    case 'disputed':
      return { label: 'Litige en cours', backgroundColor: '#FFE5D0', textColor: '#B45309', icon: '⚠️' };
    case 'cancelled':
      return { label: 'Annulée', backgroundColor: '#E2E3E5', textColor: '#383D41', icon: '✕' };
    default:
      return { label: status, backgroundColor: '#E2E3E5', textColor: '#383D41', icon: '•' };
  }
}

interface BookingBadgeProps {
  status: string;
}

export default function BookingBadge({ status }: BookingBadgeProps) {
  const badge = getBookingBadge(status);
  return (
    <View style={[styles.container, { backgroundColor: badge.backgroundColor }]}>
      <Text style={styles.icon}>{badge.icon}</Text>
      <Text style={[styles.label, { color: badge.textColor }]}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  icon: {
    fontSize: 12,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
});
