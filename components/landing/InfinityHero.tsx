import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, Platform } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, RadialGradient, Stop, G, Ellipse } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface Props {
  size?: number;
}

const INFINITY_STEPS = 300;

function buildInfinityPath(cx: number, cy: number, a: number): string {
  let d = '';
  for (let i = 0; i <= INFINITY_STEPS; i++) {
    const t = i / INFINITY_STEPS;
    const angle = t * 2 * Math.PI;
    const scale = 1 / (Math.sin(angle) * Math.sin(angle) + 1);
    const x = cx + a * Math.cos(angle) * scale;
    const y = cy + a * Math.sin(angle) * Math.cos(angle) * scale;
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d + ' Z';
}

function getInfinityPoint(t: number, cx: number, cy: number, a: number) {
  const angle = t * 2 * Math.PI;
  const scale = 1 / (Math.sin(angle) * Math.sin(angle) + 1);
  return {
    x: cx + a * Math.cos(angle) * scale,
    y: cy + a * Math.sin(angle) * Math.cos(angle) * scale,
  };
}

export function InfinityHero({ size = 280 }: Props) {
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0.333)).current;
  const orb3 = useRef(new Animated.Value(0.666)).current;
  const orb4 = useRef(new Animated.Value(0.15)).current;
  const glowPulse = useRef(new Animated.Value(0.88)).current;
  const ring1Rotate = useRef(new Animated.Value(0)).current;
  const ring2Rotate = useRef(new Animated.Value(0)).current;
  const ring3Rotate = useRef(new Animated.Value(0)).current;
  const trailOpacity = useRef(new Animated.Value(0.5)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const crossScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.spring(crossScale, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
    ]).start();

    const DURATION = 4200;

    Animated.loop(
      Animated.timing(orb1, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: false })
    ).start();
    Animated.loop(
      Animated.timing(orb2, { toValue: 1.333, duration: DURATION, easing: Easing.linear, useNativeDriver: false })
    ).start();
    Animated.loop(
      Animated.timing(orb3, { toValue: 1.666, duration: DURATION, easing: Easing.linear, useNativeDriver: false })
    ).start();
    Animated.loop(
      Animated.timing(orb4, { toValue: 1.15, duration: DURATION * 1.4, easing: Easing.linear, useNativeDriver: false })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1.1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.88, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(ring1Rotate, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(ring2Rotate, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(ring3Rotate, { toValue: -1, duration: 30000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(trailOpacity, { toValue: 0.85, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(trailOpacity, { toValue: 0.35, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const a = s * 0.26;

  const mainPath = buildInfinityPath(cx, cy, a);
  const outerPath = buildInfinityPath(cx, cy, a * 1.08);

  const makeOrbCoords = (animVal: Animated.Value, modOffset: number) => {
    const phasedT = animVal.interpolate({ inputRange: [modOffset, modOffset + 1], outputRange: [0, 1] });
    const x = animVal.interpolate({
      inputRange: Array.from({ length: 61 }, (_, i) => modOffset + i / 60),
      outputRange: Array.from({ length: 61 }, (_, i) => getInfinityPoint(i / 60, cx, cy, a).x),
      extrapolate: 'clamp',
    });
    const y = animVal.interpolate({
      inputRange: Array.from({ length: 61 }, (_, i) => modOffset + i / 60),
      outputRange: Array.from({ length: 61 }, (_, i) => getInfinityPoint(i / 60, cx, cy, a).y),
      extrapolate: 'clamp',
    });
    return { x, y };
  };

  const orb1Points = makeOrbCoords(orb1, 0);
  const orb2Points = makeOrbCoords(orb2, 0.333);
  const orb3Points = makeOrbCoords(orb3, 0.666);
  const orb4Points = makeOrbCoords(orb4, 0.15);

  const spin1 = ring1Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = ring2Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin3 = ring3Rotate.interpolate({ inputRange: [-1, 0], outputRange: ['-360deg', '0deg'] });

  return (
    <Animated.View style={[{ width: s, height: s, position: 'relative' }, { opacity: fadeIn }]}>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin1 }] }]}>
        <Svg width={s} height={s}>
          <Circle
            cx={cx} cy={cy} r={s * 0.44}
            stroke={Colors.primaryDark} strokeWidth={0.6}
            strokeDasharray="2 12" fill="none" opacity={0.25}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin2 }] }]}>
        <Svg width={s} height={s}>
          <Ellipse
            cx={cx} cy={cy} rx={s * 0.47} ry={s * 0.28}
            stroke={Colors.primary} strokeWidth={0.5}
            strokeDasharray="4 16" fill="none" opacity={0.3}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin3 }] }]}>
        <Svg width={s} height={s}>
          <Ellipse
            cx={cx} cy={cy} rx={s * 0.35} ry={s * 0.5}
            stroke={Colors.primaryLight} strokeWidth={0.4}
            strokeDasharray="3 20" fill="none" opacity={0.35}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: glowPulse }] }]}>
        <Svg width={s} height={s}>
          <Defs>
            <RadialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={Colors.primaryLight} stopOpacity="0.55" />
              <Stop offset="55%" stopColor={Colors.primary} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={cx} cy={cy}
            rx={a * 1.35} ry={a * 0.72}
            fill="url(#centerGlow)"
          />
        </Svg>
      </Animated.View>

      <Svg width={s} height={s} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="outerInfinity" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={Colors.primaryLight} stopOpacity="0.4" />
            <Stop offset="0.5" stopColor={Colors.primaryDark} stopOpacity="0.3" />
            <Stop offset="1" stopColor={Colors.primaryLight} stopOpacity="0.4" />
          </LinearGradient>
          <LinearGradient id="mainInfinity" x1="0" y1="0" x2="1" y2="0.5">
            <Stop offset="0" stopColor={Colors.primaryDark} stopOpacity="1" />
            <Stop offset="0.35" stopColor={Colors.primary} stopOpacity="1" />
            <Stop offset="0.65" stopColor={Colors.primaryDark} stopOpacity="1" />
            <Stop offset="1" stopColor={Colors.primary} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="glowInfinity" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={Colors.primaryDark} stopOpacity="0.18" />
            <Stop offset="0.5" stopColor={Colors.primary} stopOpacity="0.2" />
            <Stop offset="1" stopColor={Colors.primaryDark} stopOpacity="0.18" />
          </LinearGradient>
        </Defs>

        <Path
          d={outerPath} fill="none"
          stroke="url(#outerInfinity)"
          strokeWidth={1.5} strokeLinecap="round"
        />

        <Path
          d={mainPath} fill="none"
          stroke="url(#glowInfinity)"
          strokeWidth={18} strokeLinecap="round" strokeLinejoin="round"
        />

        <Path
          d={mainPath} fill="none"
          stroke="url(#mainInfinity)"
          strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round"
        />

        <Circle cx={cx - a * 0.52} cy={cy} r={s * 0.05} fill={Colors.primaryLight} opacity={0.6} />
        <Circle cx={cx + a * 0.52} cy={cy} r={s * 0.05} fill={Colors.primaryLight} opacity={0.6} />
        <Circle cx={cx} cy={cy} r={s * 0.018} fill={Colors.primaryDark} opacity={0.55} />

        <Circle cx={cx - a * 0.52} cy={cy} r={s * 0.025} fill={Colors.primaryDark} opacity={0.7} />
        <Circle cx={cx + a * 0.52} cy={cy} r={s * 0.025} fill={Colors.primaryDark} opacity={0.7} />
      </Svg>

      <Animated.View
        style={[
          styles.orb,
          {
            width: s * 0.075, height: s * 0.075,
            borderRadius: s * 0.0375,
            marginLeft: -(s * 0.0375), marginTop: -(s * 0.0375),
            left: orb1Points.x as any, top: orb1Points.y as any,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.orbSecond,
          {
            width: s * 0.052, height: s * 0.052,
            borderRadius: s * 0.026,
            marginLeft: -(s * 0.026), marginTop: -(s * 0.026),
            left: orb2Points.x as any, top: orb2Points.y as any,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.orbThird,
          {
            width: s * 0.038, height: s * 0.038,
            borderRadius: s * 0.019,
            marginLeft: -(s * 0.019), marginTop: -(s * 0.019),
            left: orb3Points.x as any, top: orb3Points.y as any,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.orbTiny,
          {
            width: s * 0.024, height: s * 0.024,
            borderRadius: s * 0.012,
            marginLeft: -(s * 0.012), marginTop: -(s * 0.012),
            left: orb4Points.x as any, top: orb4Points.y as any,
            opacity: trailOpacity,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    backgroundColor: Colors.primaryDark,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12 },
      android: { elevation: 8 },
      web: { boxShadow: `0 0 14px 5px ${Colors.primaryDark}88` },
    }),
  },
  orbSecond: {
    position: 'absolute',
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 9 },
      android: { elevation: 6 },
      web: { boxShadow: `0 0 10px 4px ${Colors.primary}99` },
    }),
  },
  orbThird: {
    position: 'absolute',
    backgroundColor: Colors.primaryLight,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryLight, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 7 },
      android: { elevation: 4 },
      web: { boxShadow: `0 0 8px 3px ${Colors.primaryLight}AA` },
    }),
  },
  orbTiny: {
    position: 'absolute',
    backgroundColor: Colors.primaryDark,
    opacity: 0.5,
  },
});
