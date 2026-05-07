import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { HandoverEventType } from './types';

interface Props {
  eventType: HandoverEventType;
  // When false, the component renders nothing. Trigger the animation by
  // mounting the component (visible: true) — useEffect runs on mount.
}

// Visual identity per event:
//  - handover (start) : vert primaire + texte "Location démarrée" — fête.
//  - return  (close) : bleu calme + texte "Retour validé" — clôture sereine.
const PALETTE = {
  handover: {
    accent: Colors.primaryDark,
    accentSoft: Colors.primaryDark + '22',
    title: 'Location démarrée',
    subtitle: 'Bonne location ! Pense à profiter.',
    icon: 'rocket-outline' as const,
    particles: ['🎉', '✨', '⭐'],
  },
  return: {
    accent: '#1E40AF',
    accentSoft: '#1E40AF22',
    title: 'Retour confirmé',
    subtitle: 'La caution sera libérée si l\'état est OK.',
    icon: 'checkmark-done-outline' as const,
    particles: ['✓', '✓', '✓'],
  },
};

export default function HandoverSuccessAnimation({ eventType }: Props) {
  const palette = PALETTE[eventType];

  const ringScale = useRef(new Animated.Value(0.4)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(16)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(12)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const particle1Y = useRef(new Animated.Value(0)).current;
  const particle1Opacity = useRef(new Animated.Value(0)).current;
  const particle2Y = useRef(new Animated.Value(0)).current;
  const particle2Opacity = useRef(new Animated.Value(0)).current;
  const particle3Y = useRef(new Animated.Value(0)).current;
  const particle3Opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ringOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(ringScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(checkOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(checkScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(220),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(320),
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(subtitleY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // Particles drift up + fade. Staggered.
    const driftParticle = (
      yVal: Animated.Value,
      opVal: Animated.Value,
      delay: number,
    ) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opVal, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(yVal, { toValue: -60, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.timing(opVal, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    };
    driftParticle(particle1Y, particle1Opacity, 200);
    driftParticle(particle2Y, particle2Opacity, 350);
    driftParticle(particle3Y, particle3Opacity, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      {/* Particles drift upward from the check */}
      <View style={styles.particleZone} pointerEvents="none">
        <Animated.Text
          style={[
            styles.particle,
            { left: '32%', opacity: particle1Opacity, transform: [{ translateY: particle1Y }] },
          ]}
        >
          {palette.particles[0]}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.particle,
            { left: '50%', opacity: particle2Opacity, transform: [{ translateY: particle2Y }] },
          ]}
        >
          {palette.particles[1]}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.particle,
            { left: '66%', opacity: particle3Opacity, transform: [{ translateY: particle3Y }] },
          ]}
        >
          {palette.particles[2]}
        </Animated.Text>
      </View>

      <View style={styles.iconWrap}>
        <Animated.View
          style={[
            styles.ring,
            {
              backgroundColor: palette.accentSoft,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
        <Animated.View
          style={{
            opacity: checkOpacity,
            transform: [{ scale: checkScale }],
          }}
        >
          <Ionicons name={palette.icon} size={56} color={palette.accent} />
        </Animated.View>
      </View>

      <Animated.Text
        style={[
          styles.title,
          { color: palette.accent, opacity: titleOpacity, transform: [{ translateY: titleY }] },
        ]}
      >
        {palette.title}
      </Animated.Text>
      <Animated.Text
        style={[styles.subtitle, { opacity: subtitleOpacity, transform: [{ translateY: subtitleY }] }]}
      >
        {palette.subtitle}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    minHeight: 220,
    gap: 8,
  },
  particleZone: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    fontSize: 22,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 112,
    height: 112,
    marginBottom: 6,
  },
  ring: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 19,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    ...Platform.select({ web: { lineHeight: 18 } }),
  },
});
