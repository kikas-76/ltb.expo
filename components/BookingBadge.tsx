import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BadgeConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
  iconName: string;
}

export function getBookingBadge(status: string): BadgeConfig {
  switch (status) {
    case 'pending':
      return { label: 'En attente', backgroundColor: '#FFF3CD', textColor: '#856404', iconName: 'time-outline' };
    case 'accepted':
      return { label: 'Acceptée', backgroundColor: '#D4EDDA', textColor: '#155724', iconName: 'checkmark-circle-outline' };
    case 'active':
      return { label: 'Prêt pour la remise', backgroundColor: '#1B4332', textColor: '#FFFFFF', iconName: 'hand-left-outline' };
    case 'pending_return':
      return { label: 'Retour en cours', backgroundColor: '#CCE5FF', textColor: '#004085', iconName: 'return-down-back-outline' };
    case 'completed':
      return { label: 'Terminée', backgroundColor: '#E2E3E5', textColor: '#383D41', iconName: 'checkmark-done-outline' };
    case 'rejected':
    case 'refused':
      return { label: 'Refusée', backgroundColor: '#F8D7DA', textColor: '#721C24', iconName: 'close-circle-outline' };
    case 'disputed':
      return { label: 'Litige en cours', backgroundColor: '#FFE5D0', textColor: '#B45309', iconName: 'warning-outline' };
    case 'cancelled':
      return { label: 'Annulée', backgroundColor: '#E2E3E5', textColor: '#383D41', iconName: 'close-outline' };
    default:
      return { label: status, backgroundColor: '#E2E3E5', textColor: '#383D41', iconName: 'time-outline' };
  }
}

interface BookingBadgeProps {
  status: string;
}

export default function BookingBadge({ status }: BookingBadgeProps) {
  const badge = getBookingBadge(status);
  return (
    <View style={[styles.container, { backgroundColor: badge.backgroundColor }]}>
      <Ionicons name={badge.iconName as any} size={12} color={badge.textColor} />
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
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
});
