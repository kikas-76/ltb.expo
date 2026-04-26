import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

interface SkeletonCardProps {
  variant?: 'horizontal' | 'grid';
}

export default function SkeletonCard({ variant = 'grid' }: SkeletonCardProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View style={[styles.card, variant === 'horizontal' && styles.cardHorizontal, { opacity }]}>
      <View style={[styles.imageArea, variant === 'horizontal' && styles.imageAreaHorizontal]} />
      <View style={styles.body}>
        <View style={styles.lineLong} />
        <View style={styles.lineShort} />
        <View style={styles.lineXs} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHorizontal: {
    width: '100%',
  },
  imageArea: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: Colors.borderLight,
  },
  imageAreaHorizontal: {
    aspectRatio: 4 / 3,
  },
  body: {
    padding: 10,
    gap: 8,
  },
  lineLong: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
    width: '80%',
  },
  lineShort: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
    width: '45%',
  },
  lineXs: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.borderLight,
    width: '60%',
  },
});
