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
});
