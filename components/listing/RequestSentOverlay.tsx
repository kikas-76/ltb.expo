import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
}

interface Props {
  visible: boolean;
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
  }));
}

export default function RequestSentOverlay({ visible }: Props) {
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.6)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;
  const particles = useRef(createParticles(10)).current;

  useEffect(() => {
    if (!visible) return;

    bgOpacity.setValue(0);
    cardScale.setValue(0.6);
    cardOpacity.setValue(0);
    checkScale.setValue(0);
    iconBounce.setValue(0);
    particles.forEach((p) => {
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(0);
      p.scale.setValue(0);
    });

    Animated.sequence([
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.stagger(
        40,
        particles.map((p, i) => {
          const angle = (i / particles.length) * 2 * Math.PI;
          const dist = 80 + Math.random() * 40;
          return Animated.parallel([
            Animated.timing(p.opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 1, duration: 120, useNativeDriver: true }),
            Animated.timing(p.x, {
              toValue: Math.cos(angle) * dist,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(p.y, {
              toValue: Math.sin(angle) * dist,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(300),
              Animated.timing(p.opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
            ]),
          ]);
        })
      ),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(iconBounce, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(iconBounce, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    ).start();
  }, [visible]);

  if (!visible) return null;

  const particleColors = [Colors.primary, Colors.primaryDark, '#D4DAC4', '#8E9878', '#B7BF9C', '#ECEEE6'];

  return (
    <Animated.View style={[styles.overlay, { opacity: bgOpacity }]}>
      <Animated.View
        style={[
          styles.card,
          { opacity: cardOpacity, transform: [{ scale: cardScale }] },
        ]}
      >
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                backgroundColor: particleColors[i % particleColors.length],
                opacity: p.opacity,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { scale: p.scale },
                ],
              },
            ]}
          />
        ))}

        <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }, { translateY: iconBounce }] }]}>
          <Ionicons name="checkmark-outline" size={32} color={Colors.white} />
        </Animated.View>

        <Text style={styles.title}>Demande envoyée !</Text>
        <Text style={styles.subtitle}>Le propriétaire a été notifié.</Text>

        <View style={styles.messageBadge}>
          <Ionicons name="chatbubble-outline" size={13} color={Colors.primaryDark} />
          <Text style={styles.messageBadgeText}>Rendez-vous dans vos messages</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    paddingHorizontal: 36,
    paddingVertical: 40,
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.82,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24 },
      android: { elevation: 12 },
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
    }),
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: Colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 16px rgba(142,152,120,0.5)' },
    }),
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  messageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight + '50',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '60',
  },
  messageBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
