import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { EmptyIllustration, type EmptyIllustrationName } from '@/components/EmptyIllustration';
import { haptics } from '@/lib/haptics';

interface Props {
  illustration: EmptyIllustrationName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Version resserrée pour les listes courtes. */
  compact?: boolean;
}

/**
 * État vide chaleureux : illustration maison, une phrase, et un bouton
 * d'action quand il y a quelque chose d'utile à faire.
 */
export default function EmptyState({ illustration, title, subtitle, actionLabel, onAction, compact }: Props) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <EmptyIllustration name={illustration} size={compact ? 104 : 136} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            haptics.confirm();
            onAction();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 32,
    gap: 6,
  },
  containerCompact: {
    paddingVertical: 20,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    lineHeight: 22,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  btn: {
    marginTop: 14,
    backgroundColor: Colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  btnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
});
