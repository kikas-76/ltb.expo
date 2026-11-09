import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/colors';
import InfinityLoader from '@/components/InfinityLoader';

interface Props {
  /** Tant que vrai, l'écran reste affiché ; à false il se fond puis se démonte. */
  visible: boolean;
  /** Version courte pour les utilisateurs qui reviennent : tracé et logo accélérés. */
  quick?: boolean;
  onHidden?: () => void;
}

/**
 * Écran de démarrage : le ∞ du logo se trace, un filet vert le parcourt
 * pendant que l'app finit de charger, le logo apparaît dessous. Même fond que
 * le splash natif (Colors.background) pour une transition sans à-coup.
 */
export default function AnimatedSplash({ visible, quick = false, onHidden }: Props) {
  const [mounted, setMounted] = useState(true);
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoRise = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const delay = quick ? 100 : 700;
    const duration = quick ? 300 : 600;
    Animated.parallel([
      Animated.timing(logoFade, { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.timing(logoRise, { toValue: 0, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (visible) return;
    Animated.timing(rootOpacity, {
      toValue: 0,
      duration: 380,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setMounted(false);
      onHidden?.();
    });
  }, [visible]);

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.root, { opacity: rootOpacity }]} pointerEvents="none">
      <View style={styles.center}>
        <InfinityLoader size={230} drawDuration={quick ? 500 : undefined} />
        <Animated.Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={[styles.logo, { opacity: logoFade, transform: [{ translateY: logoRise }] }]}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 26,
  },
  logo: {
    width: 190,
    height: 50,
  },
});
