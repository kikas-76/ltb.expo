import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height: height as any, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonListingCard() {
  return (
    <View style={styles.card}>
      <Skeleton height={140} radius={12} />
      <View style={styles.cardBody}>
        <Skeleton height={14} width="80%" />
        <Skeleton height={12} width="50%" />
        <Skeleton height={18} width="40%" radius={999} />
      </View>
    </View>
  );
}

export function SkeletonRow({ avatar = false }: { avatar?: boolean }) {
  return (
    <View style={styles.row}>
      {avatar && <Skeleton width={40} height={40} radius={999} />}
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton height={14} width="70%" />
        <Skeleton height={12} width="40%" />
      </View>
    </View>
  );
}

// Vertical card layout used on listing grids (favorites, search, popular, etc.)
export function SkeletonGridCard() {
  return (
    <View style={styles.gridCard}>
      <Skeleton height={140} radius={12} />
      <View style={{ gap: 6, paddingHorizontal: 2 }}>
        <Skeleton height={14} width="80%" />
        <Skeleton height={13} width="50%" />
        <Skeleton height={11} width="40%" radius={999} />
      </View>
    </View>
  );
}

// Conversation row for reservations list
export function SkeletonConversationRow() {
  return (
    <View style={styles.convRow}>
      <Skeleton width={56} height={56} radius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton height={14} width="55%" />
        <Skeleton height={12} width="80%" />
        <Skeleton height={11} width="35%" />
      </View>
    </View>
  );
}

// Profile header (avatar + name + meta)
export function SkeletonProfileHeader() {
  return (
    <View style={styles.profileHeader}>
      <Skeleton width={88} height={88} radius={999} />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Skeleton height={20} width={160} />
        <Skeleton height={14} width={200} />
        <Skeleton height={14} width={120} />
      </View>
    </View>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonGridCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#E8E5D8',
  },
  card: {
    width: 200,
    gap: 10,
    marginRight: 12,
  },
  cardBody: {
    gap: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  gridCard: {
    flex: 1,
    minWidth: 150,
    maxWidth: '48%' as any,
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E5D8',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 16,
  },
});
