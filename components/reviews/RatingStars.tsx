import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface Props {
  value: number;
  onChange?: (next: number) => void;
  size?: number;
  readonly?: boolean;
  // Color of the filled star. Defaults to a warm amber that reads well
  // both on light cards and on the green primary surface.
  color?: string;
}

// Five-star rating row. Clickable when `onChange` is provided, otherwise
// a static display. Half-star precision isn't supported on input — submit
// flow uses whole numbers (1..5). Read-only mode rounds to nearest int
// so a 4.4 displays as 4 stars (we surface the precise number next to it
// in callers when needed).
export default function RatingStars({
  value,
  onChange,
  size = 28,
  readonly = false,
  color = '#F59E0B',
}: Props) {
  const interactive = !!onChange && !readonly;
  const display = Math.round(value);

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        const Icon = (
          <Ionicons
            name={filled ? 'star' : 'star-outline'}
            size={size}
            color={filled ? color : Colors.textMuted}
          />
        );
        if (!interactive) {
          return <View key={n} style={styles.starWrap}>{Icon}</View>;
        }
        return (
          <TouchableOpacity
            key={n}
            style={styles.starWrap}
            activeOpacity={0.6}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            onPress={() => onChange?.(n)}
          >
            {Icon}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  starWrap: { padding: 2 },
});
