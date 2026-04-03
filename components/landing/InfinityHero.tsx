import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { Colors } from '@/constants/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface Props {
  size?: number;
}

export function InfinityHero({ size = 280 }: Props) {
  const orb1Pos = useRef(new Animated.Value(0)).current;
  const orb2Pos = useRef(new Animated.Value(0.5)).current;
  const glowScale = useRef(new Animated.Value(0.92)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.timing(orb1Pos, {
        toValue: 1,
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: false,
      })
    ).start();

    Animated.loop(
      Animated.timing(orb2Pos, {
        toValue: 1.5,
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: false,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.06,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 0.92,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const a = s * 0.22;

  const STEPS = 200;
  const getInfinityPoint = (t: number) => {
    const angle = t * 2 * Math.PI;
    const scale = 1 / (Math.sin(angle) * Math.sin(angle) + 1);
    const x = cx + a * Math.cos(angle) * scale;
    const y = cy + a * Math.sin(angle) * Math.cos(angle) * scale;
    return { x, y };
  };

  let pathD = '';
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const { x, y } = getInfinityPoint(t);
    pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  pathD += ' Z';

  const orb1X = orb1Pos.interpolate({
    inputRange: [0, 1],
    outputRange: [cx + a * 0.6, cx - a * 0.6],
  });
  const orb1Y = orb1Pos.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [cy, cy - a * 0.35, cy, cy + a * 0.35, cy],
  });

  const orb2X = orb2Pos.interpolate({
    inputRange: [0.5, 1, 1.5],
    outputRange: [cx - a * 0.6, cx + a * 0.6, cx - a * 0.6],
  });
  const orb2Y = orb2Pos.interpolate({
    inputRange: [0.5, 0.75, 1, 1.25, 1.5],
    outputRange: [cy, cy + a * 0.35, cy, cy - a * 0.35, cy],
  });

  const spin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { width: s, height: s, opacity: fadeIn },
      ]}
    >
      <Animated.View style={[styles.glowWrapper, { transform: [{ scale: glowScale }] }]}>
        <View
          style={[
            styles.glow,
            {
              width: s * 0.72,
              height: s * 0.38,
              borderRadius: s * 0.19,
              top: cy - s * 0.19,
              left: cx - s * 0.36,
            },
          ]}
        />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin }] }]}>
        <Svg width={s} height={s}>
          <Circle
            cx={cx}
            cy={cy}
            r={s * 0.42}
            stroke={Colors.primary}
            strokeWidth={0.5}
            strokeDasharray="3 8"
            fill="none"
            opacity={0.35}
          />
        </Svg>
      </Animated.View>

      <Svg width={s} height={s} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="infinityGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={Colors.primaryDark} stopOpacity="1" />
            <Stop offset="0.5" stopColor={Colors.primary} stopOpacity="1" />
            <Stop offset="1" stopColor={Colors.primaryDark} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.primaryLight} stopOpacity="0.6" />
            <Stop offset="1" stopColor={Colors.primaryLight} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        <Path
          d={pathD}
          fill="none"
          stroke="url(#infinityGrad)"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={pathD}
          fill="none"
          stroke={Colors.primary}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.12}
        />

        <Circle cx={cx - a * 0.55} cy={cy} r={s * 0.055} fill={Colors.primaryLight} opacity={0.5} />
        <Circle cx={cx + a * 0.55} cy={cy} r={s * 0.055} fill={Colors.primaryLight} opacity={0.5} />
        <Circle cx={cx} cy={cy} r={s * 0.022} fill={Colors.primaryDark} opacity={0.4} />
      </Svg>

      <Animated.View
        style={[
          styles.orb,
          {
            width: s * 0.07,
            height: s * 0.07,
            borderRadius: s * 0.035,
            marginLeft: -(s * 0.035),
            marginTop: -(s * 0.035),
            left: orb1X as any,
            top: orb1Y as any,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orbSecond,
          {
            width: s * 0.048,
            height: s * 0.048,
            borderRadius: s * 0.024,
            marginLeft: -(s * 0.024),
            marginTop: -(s * 0.024),
            left: orb2X as any,
            top: orb2Y as any,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
  },
  glowWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  glow: {
    position: 'absolute',
    backgroundColor: Colors.primaryLight,
    opacity: 0.28,
  },
  orb: {
    position: 'absolute',
    backgroundColor: Colors.primaryDark,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  orbSecond: {
    position: 'absolute',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
});
