import { View, Text, StyleSheet } from 'react-native';
import { Clock, CircleCheck, Handshake, CornerDownLeft, CheckCheck, CircleX, TriangleAlert, Ban } from 'lucide-react-native';

interface BadgeConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
}

export function getBookingBadge(status: string): BadgeConfig {
  switch (status) {
    case 'pending':
      return { label: 'En attente', backgroundColor: '#FEF3C7', textColor: '#92400E', Icon: Clock };
    case 'accepted':
      return { label: 'Acceptée', backgroundColor: '#DCFCE7', textColor: '#166534', Icon: CircleCheck };
    case 'active':
      return { label: 'Prêt pour la remise', backgroundColor: '#1B4332', textColor: '#FFFFFF', Icon: Handshake };
    case 'pending_return':
      return { label: 'Retour en cours', backgroundColor: '#DBEAFE', textColor: '#1E40AF', Icon: CornerDownLeft };
    case 'completed':
      return { label: 'Terminée', backgroundColor: '#F1F5F9', textColor: '#475569', Icon: CheckCheck };
    case 'rejected':
    case 'refused':
      return { label: 'Refusée', backgroundColor: '#FEE2E2', textColor: '#991B1B', Icon: CircleX };
    case 'disputed':
      return { label: 'Litige en cours', backgroundColor: '#FEF3C7', textColor: '#B45309', Icon: TriangleAlert };
    case 'cancelled':
      return { label: 'Annulée', backgroundColor: '#F1F5F9', textColor: '#475569', Icon: Ban };
    default:
      return { label: status, backgroundColor: '#F1F5F9', textColor: '#475569', Icon: Clock };
  }
}

interface BookingBadgeProps {
  status: string;
}

export default function BookingBadge({ status }: BookingBadgeProps) {
  const badge = getBookingBadge(status);
  const { Icon } = badge;
  return (
    <View style={[styles.container, { backgroundColor: badge.backgroundColor }]}>
      <Icon size={11} color={badge.textColor} strokeWidth={2.5} />
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
