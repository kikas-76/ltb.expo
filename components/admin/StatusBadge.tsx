import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  open: { label: 'Ouvert', bg: Colors.errorLight, color: Colors.error },
  pending: { label: 'En attente', bg: Colors.warningLight, color: Colors.warningDark },
  under_review: { label: 'En cours', bg: Colors.infoLight, color: Colors.info },
  resolved: { label: 'Résolu', bg: Colors.primarySurface, color: Colors.primaryDark },
  completed: { label: 'Terminé', bg: Colors.successGreenLight, color: Colors.successGreen },
  active: { label: 'Actif', bg: Colors.successGreenLight, color: Colors.successGreen },
  in_progress: { label: 'En cours', bg: Colors.infoLight, color: Colors.info },
  refused: { label: 'Refusé', bg: Colors.borderLight, color: Colors.textSecondary },
  cancelled: { label: 'Annulé', bg: Colors.borderLight, color: Colors.textSecondary },
  confirmed: { label: 'Confirmé', bg: Colors.infoLight, color: Colors.info },
  seen: { label: 'Vu', bg: Colors.primarySurface, color: Colors.primaryDark },
  rejected: { label: 'Rejeté', bg: Colors.borderLight, color: Colors.textSecondary },
  suspended: { label: 'Suspendu', bg: Colors.suspendedLight, color: Colors.suspended },
  banned: { label: 'Banni', bg: Colors.bannedLight, color: Colors.banned },
  flagged: { label: 'Signalé', bg: Colors.errorLight, color: Colors.error },
};

interface StatusBadgeProps {
  status: string;
  small?: boolean;
}

export default function StatusBadge({ status, small }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, bg: Colors.borderLight, color: Colors.textSecondary };
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, small && styles.badgeSmall]}>
      <Text style={[styles.text, { color: config.color }, small && styles.textSmall]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  textSmall: {
    fontSize: 11,
  },
});
