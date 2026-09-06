import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { buildInfinityPath, getInfinityPoint } from '@/components/landing/InfinityHero';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const STEPS = 300;
/** Lobes arrondis, proportions du ∞ du logo LoueTonBien (≈ 2:1). */
const Y_SCALE = 1.35;

function infinityLength(cx: number, cy: number, a: number): number {
  let len = 0;
  let prev = getInfinityPoint(0, cx, cy, a, Y_SCALE);
  for (let i = 1; i <= STEPS; i++) {
    const p = getInfinityPoint(i / STEPS, cx, cy, a, Y_SCALE);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

interface Props {
  /** Largeur du symbole. */
  size?: number;
  /** Couleur du trait principal (noir du logo par défaut). */
  color?: string;
  /** Couleur du filet lumineux qui parcourt le symbole. */
  accent?: string;
  /** Durée du tracé initial (0 = symbole déjà complet). */
  drawDuration?: number;
}

/**
 * Le ∞ du logo, animé : trait épais et arrondi qui se trace, puis un filet
 * vert qui le parcourt en boucle. Toutes les animations pilotent des
 * propriétés SVG (côté JS) ; aucune vue ne mélange les deux pilotes.
 */
export default function InfinityLoader({
  size = 220,
  color = Colors.text,
  accent = Colors.primary,
  drawDuration = 1200,
}: Props) {
  const draw = useRef(new Animated.Value(drawDuration > 0 ? 0 : 1)).current;
  const comet = useRef(new Animated.Value(0)).current;

  const { d, length, height, strokeWidth } = useMemo(() => {
    const a = size / 2;
    const h = Math.round(size * 0.52);
    const cx = size / 2;
    const cy = h / 2;
    // Rayon réduit pour laisser la place au trait épais.
    const r = a - size * 0.07;
    return {
      d: buildInfinityPath(cx, cy, r, Y_SCALE),
      length: infinityLength(cx, cy, r),
      height: h,
      strokeWidth: Math.round(size * 0.115),
    };
  }, [size]);

  useEffect(() => {
    if (drawDuration > 0) {
      Animated.timing(draw, {
        toValue: 1,
        duration: drawDuration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
    const loop = Animated.loop(
      Animated.timing(comet, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const drawOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [length, 0] });
  // Motif [segment, trou] de période longueur + segment : un décalage d'une
  // période redonne exactement le même dessin, la boucle est donc invisible.
  const cometDash = length * 0.16;
  const cometPeriod = length + cometDash;
  const cometOffset = comet.interpolate({ inputRange: [0, 1], outputRange: [0, -cometPeriod] });

  return (
    <View style={{ width: size, height }}>
      <Svg width={size} height={height}>
        <AnimatedPath
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[length, length]}
          strokeDashoffset={drawOffset}
        />
        <AnimatedPath
          d={d}
          fill="none"
          stroke={accent}
          strokeWidth={strokeWidth * 0.45}
          strokeLinecap="round"
          strokeDasharray={[cometDash, length]}
          strokeDashoffset={cometOffset}
        />
      </Svg>
    </View>
  );
}
