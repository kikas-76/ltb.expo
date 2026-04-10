import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

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
      return { label: 'Prêt pour la remise', backgroundColor: Colors.primaryDark, textColor: '#FFFFFF', iconName: 'hand-left-outline' };
    case 'in_progress':
      return { label: 'En cours', backgroundColor: '#0369A1', textColor: '#FFFFFF', iconName: 'play-circle-outline' };
    case 'pending_return':
      return { label: 'Retour en cours', backgroundColor: '#CCE5FF', textColor: '#004085', iconName: 'return-down-back-outline' };
    case 'completed':
      return { label: 'Terminée', backgroundColor: '#E2E3E5', textColor: '#383D41', iconName: 'checkmark-done-outline' };
    case 'rejected':
    case 'refused':
      return { label: 'Refusée', backgroundColor: '#F8D7DA', textColor: '#721C24', iconName: 'close-circle-outline' };
    case 'pending_owner_validation':
      return { label: 'Validation propriétaire', backgroundColor: '#FFF0CD', textColor: '#92400E', iconName: 'shield-checkmark-outline' };
    case 'disputed':
      return { label: 'Litige en cours', backgroundColor: '#FFE5D0', textColor: '#B45309', iconName: 'warning-outline' };
    case 'cancelled':
      return { label: 'Annulée', backgroundColor: '#E2E3E5', textColor: '#383D41', iconName: 'close-outline' };
    default:
      return { label: status, backgroundColor: '#E2E3E5', textColor: '#383D41', iconName: 'time-outline' };
  }
}

export type RentalStep = 'accepted' | 'active' | 'in_progress' | 'pending_return' | 'pending_owner_validation' | 'completed';

const STEPS: { key: RentalStep; label: string }[] = [
  { key: 'accepted', label: 'Payé' },
  { key: 'active', label: 'Remise' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'pending_return', label: 'Retour' },
  { key: 'pending_owner_validation', label: 'Validation' },
  { key: 'completed', label: 'Terminé' },
];

const STEP_ORDER: Record<string, number> = {
  accepted: 0,
  active: 1,
  in_progress: 2,
  pending_return: 3,
  pending_owner_validation: 4,
  completed: 5,
};

interface BookingProgressProps {
  status: string;
}

export function BookingProgress({ status }: BookingProgressProps) {
  const currentIndex = STEP_ORDER[status] ?? -1;
  if (currentIndex === -1) return null;

  return (
    <View style={progressStyles.container}>
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <View key={step.key} style={progressStyles.stepWrapper}>
            <View style={[
              progressStyles.dot,
              done && progressStyles.dotDone,
              active && progressStyles.dotActive,
            ]}>
              {done && <Ionicons name="checkmark" size={9} color="#fff" />}
              {active && <View style={progressStyles.dotInner} />}
            </View>
            <Text style={[
              progressStyles.stepLabel,
              done && progressStyles.stepLabelDone,
              active && progressStyles.stepLabelActive,
            ]}>
              {step.label}
            </Text>
            {i < STEPS.length - 1 && (
              <View style={[progressStyles.line, done && progressStyles.lineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
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

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotDone: {
    backgroundColor: Colors.primaryDark,
  },
  dotActive: {
    backgroundColor: '#0369A1',
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  stepLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 9,
    color: '#A0A0A0',
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelDone: {
    color: Colors.primaryDark,
    fontFamily: 'Inter-SemiBold',
  },
  stepLabelActive: {
    color: '#0369A1',
    fontFamily: 'Inter-Bold',
  },
  line: {
    position: 'absolute',
    top: 10,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: Colors.border,
    zIndex: 0,
  },
  lineDone: {
    backgroundColor: Colors.primaryDark,
  },
});
