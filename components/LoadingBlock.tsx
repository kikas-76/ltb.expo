import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import InfinityLoader from '@/components/InfinityLoader';

interface Props {
  label?: string;
  /** Occupe tout l'espace disponible (écran de chargement). */
  fill?: boolean;
  size?: number;
}

/**
 * Chargement long : le ∞ du logo qui se trace et son filet vert, à la place
 * du spinner système. Même langage que le splash et l'intro de l'accueil.
 */
export default function LoadingBlock({ label, fill = true, size = 120 }: Props) {
  return (
    <View style={[styles.wrap, fill && styles.fill]}>
      <InfinityLoader size={size} drawDuration={900} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 24,
  },
  fill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
