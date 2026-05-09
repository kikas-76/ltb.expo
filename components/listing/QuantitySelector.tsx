import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface Props {
  value: number;
  onChange: (next: number) => void;
  stockCount: number;
  packs: number[] | null | undefined;
  // Optional: how many units are still bookable for the chosen window.
  // When defined, picks above are visually disabled (still tappable for
  // discoverability, but the parent should reject submission).
  maxAvailable?: number;
}

// Cross-platform numeric picker:
// - if `packs` is non-empty → pills (one per allowed pack size)
// - else → compact stepper with [-] [n] [+]
// In both modes the visible upper bound is `stockCount`. When
// `maxAvailable` is provided and < stockCount, picks above it are
// rendered with reduced opacity to hint at saturation.
export default function QuantitySelector({
  value,
  onChange,
  stockCount,
  packs,
  maxAvailable,
}: Props) {
  const usePacks = Array.isArray(packs) && packs.length > 0;
  const cappedMax = typeof maxAvailable === 'number'
    ? Math.max(0, Math.min(stockCount, Math.floor(maxAvailable)))
    : stockCount;

  if (usePacks) {
    return (
      <View style={styles.pillsRow}>
        {packs!.map((p) => {
          const isSelected = p === value;
          const isUnavailable = p > cappedMax;
          return (
            <TouchableOpacity
              key={p}
              style={[
                styles.pill,
                isSelected && styles.pillSelected,
                isUnavailable && styles.pillUnavailable,
              ]}
              onPress={() => onChange(p)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {p}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  const dec = () => {
    if (value > 1) onChange(value - 1);
  };
  const inc = () => {
    if (value < stockCount) onChange(value + 1);
  };

  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity
        style={[styles.stepperBtn, value <= 1 && styles.stepperBtnDisabled]}
        onPress={dec}
        disabled={value <= 1}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={16} color={value <= 1 ? Colors.textMuted : Colors.primaryDark} />
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value}</Text>
      <TouchableOpacity
        style={[styles.stepperBtn, value >= stockCount && styles.stepperBtnDisabled]}
        onPress={inc}
        disabled={value >= stockCount}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={16} color={value >= stockCount ? Colors.textMuted : Colors.primaryDark} />
      </TouchableOpacity>
      <Text style={styles.stepperHint}>/ {stockCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  pillSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  pillUnavailable: {
    opacity: 0.45,
  },
  pillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: '#F5F5F5',
  },
  stepperValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.text,
    minWidth: 32,
    textAlign: 'center',
    fontVariant: Platform.OS === 'web' ? undefined : ['tabular-nums'],
  },
  stepperHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 4,
  },
});
