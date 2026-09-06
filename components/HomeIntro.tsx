import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import InfinityLoader from '@/components/InfinityLoader';

const WORDS: { text: string; accent?: boolean }[] = [
  { text: 'Tout' }, { text: 'ce' }, { text: 'dont' }, { text: 'vous' }, { text: 'avez' }, { text: 'besoin,' },
  { text: 'autour', accent: true }, { text: 'de', accent: true }, { text: 'vous.', accent: true },
];

function AnimatedWord({ text, accent, delay }: { text: string; accent?: boolean; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY: rise }] }}>
      <Text style={[styles.word, accent && styles.wordAccent]}>{text}</Text>
    </Animated.View>
  );
}

interface Props {
  visible: boolean;
}

/**
 * Premier chargement de l'accueil (aucune donnée en cache) : à la place des
 * squelettes, le ∞ animé et la promesse de la marque qui s'écrit mot à mot.
 */
export default function HomeIntro({ visible }: Props) {
  const [mounted, setMounted] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) return;
    Animated.timing(opacity, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(() => setMounted(false));
  }, [visible]);

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.root, { opacity }]} pointerEvents="none">
      <InfinityLoader size={200} />
      <View style={styles.tagline}>
        {WORDS.map((w, i) => (
          <AnimatedWord key={i} text={w.text} accent={w.accent} delay={500 + i * 90} />
        ))}
      </View>
      <Text style={styles.hint}>Chargement des annonces autour de vous…</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 28,
  },
  tagline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 7,
    rowGap: 2,
    maxWidth: 340,
  },
  word: {
    fontFamily: 'Inter-Bold',
    fontSize: 26,
    lineHeight: 34,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  wordAccent: {
    color: Colors.primaryDark,
  },
  hint: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
});
