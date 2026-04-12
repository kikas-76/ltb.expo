import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  open: { label: 'Ouvert', bg: Colors.errorLight, color: Colors.error },
  pending: { label: 'En attente', bg: Colors.warningLight, color: Colors.warningDark },
  under_review: { label: 'En cours', bg: Colors.infoLight, color: Colors.info },
  resolved: { label: 'Résolu', bg: Colors.primarySurface, color: Colors.primaryDark },
  completed: { label: 'Terminé', bg: Colors.primarySurface, color: Colors.primaryDark },
  active: { label: 'Actif', bg: Colors.infoLight, color: Colors.info },
  in_progress: { label: 'En cours', bg: Colors.infoLight, color: Colors.info },
  refused: { label: 'Refusé', bg: Colors.borderLight, color: Colors.textSecondary },
  cancelled: { label: 'Annulé', bg: Colors.borderLight, color: Colors.textSecondary },
  confirmed: { label: 'Confirmé', bg: Colors.primarySurface, color: Colors.primaryDark },
  seen: { label: 'Vu', bg: Colors.primarySurface, color: Colors.primaryDark },
  rejected: { label: 'Rejeté', bg: Colors.borderLight, color: Colors.textSecondary },
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
