import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SuccessOverlayProps {
  visible: boolean;
  isEditMode: boolean;
  listingName?: string;
}

export default function SuccessOverlay({ visible, isEditMode, listingName }: SuccessOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const particle1 = useRef(new Animated.Value(0)).current;
  const particle2 = useRef(new Animated.Value(0)).current;
  const particle3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.spring(scale, {
      toValue: 1,
      delay: 80,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 1.8,
          duration: 500,
          easing: Easing.out(Easing.circle),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.circle),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(250),
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 1,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(titleTranslateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(520),
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(subtitleTranslateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    const animateParticle = (anim: Animated.Value, delay: number) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      ]).start();
    };

    animateParticle(particle1, 300);
    animateParticle(particle2, 380);
    animateParticle(particle3, 460);
  }, [visible]);

  if (!visible) return null;

  const p1Y = particle1.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
  const p1X = particle1.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const p1O = particle1.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] });

  const p2Y = particle2.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const p2X = particle2.interpolate({ inputRange: [0, 1], outputRange: [0, 30] });
  const p2O = particle2.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] });

  const p3Y = particle3.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const p3X = particle3.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
  const p3O = particle3.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0] });

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.iconWrapper}>
          <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <View style={styles.circle}>
            <Animated.View style={{ transform: [{ scale: checkScale }], opacity: checkOpacity }}>
              <Ionicons name="checkmark-outline" size={38} color={Colors.white} />
            </Animated.View>
          </View>

          <Animated.View style={[styles.particle, styles.particle1, { transform: [{ translateY: p1Y }, { translateX: p1X }], opacity: p1O }]} />
          <Animated.View style={[styles.particle, styles.particle2, { transform: [{ translateY: p2Y }, { translateX: p2X }], opacity: p2O }]} />
          <Animated.View style={[styles.particle, styles.particle3, { transform: [{ translateY: p3Y }, { translateX: p3X }], opacity: p3O }]} />
        </View>

        <Animated.Text style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}>
          {isEditMode ? 'Annonce modifiée !' : 'Annonce publiée !'}
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity, transform: [{ translateY: subtitleTranslateY }] }]}>
          {isEditMode
            ? `Les modifications de "${listingName}" ont bien été enregistrées.`
            : `"${listingName}" est maintenant visible par tous les locataires.`}
        </Animated.Text>

        <Animated.View style={[styles.hint, { opacity: subtitleOpacity }]}>
          <Text style={styles.hintText}>Redirection en cours…</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 242, 227, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 0,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  ring: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  circle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  particle: {
    position: 'absolute',
    borderRadius: 4,
  },
  particle1: {
    width: 10,
    height: 10,
    backgroundColor: Colors.primary,
  },
  particle2: {
    width: 7,
    height: 7,
    backgroundColor: Colors.primaryDark,
  },
  particle3: {
    width: 8,
    height: 8,
    backgroundColor: Colors.primaryLight,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  hint: {
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
});
