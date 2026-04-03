import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const FEATURES = [
  { icon: 'tool', label: 'Outillage' },
  { icon: 'truck', label: 'Véhicules' },
  { icon: 'camera', label: 'Photo & Vidéo' },
  { icon: 'home', label: 'Maison' },
  { icon: 'music', label: 'Événements' },
  { icon: 'layers', label: 'Et bien plus…' },
];

export default function LandingScreen() {
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('stripe_return') === '1') {
        window.close();
      }
    }
  }, []);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(-18)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const cardsTranslate = useRef(new Animated.Value(20)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;
  const btnTranslate = useRef(new Animated.Value(24)).current;
  const loginAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(heroTranslate, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardsAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(cardsTranslate, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(btnTranslate, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
      Animated.timing(loginAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  const maxWidth = Math.min(width, 480);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={[styles.inner, { maxWidth }]}>
        <Animated.View
          style={[
            styles.heroSection,
            { opacity: heroAnim, transform: [{ translateY: heroTranslate }] },
          ]}
        >
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Location entre particuliers</Text>
            </View>
          </View>

          <Text style={styles.headline}>
            Louez ce dont{'\n'}vous avez besoin,{'\n'}
            <Text style={styles.headlineAccent}>près de chez vous.</Text>
          </Text>

          <Text style={styles.subline}>
            Des milliers d'objets disponibles autour de vous. Économisez, partagez et consommez autrement.
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.categoriesGrid,
            { opacity: cardsAnim, transform: [{ translateY: cardsTranslate }] },
          ]}
        >
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.catCard}>
              <View style={styles.catIconWrap}>
                <Feather name={f.icon as any} size={18} color={Colors.primaryDark} />
              </View>
              <Text style={styles.catLabel}>{f.label}</Text>
            </View>
          ))}
        </Animated.View>

        <View style={styles.actionsSection}>
          <Animated.View
            style={{
              opacity: btnAnim,
              transform: [{ translateY: btnTranslate }],
            }}
          >
            <TouchableOpacity
              style={styles.mainBtn}
              onPress={() => router.push('/register')}
              activeOpacity={0.82}
            >
              <Ionicons name="mail-outline" size={20} color={Colors.white} />
              <Text style={styles.mainBtnText}>Commencer avec un email</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ opacity: loginAnim }}>
            <TouchableOpacity
              onPress={() => router.push('/login')}
              activeOpacity={0.7}
              style={styles.loginRow}
            >
              <Text style={styles.loginText}>Déjà un compte ? </Text>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Animated.View style={[styles.trustRow, { opacity: loginAnim }]}>
          <View style={styles.trustItem}>
            <Text style={styles.trustNumber}>10k+</Text>
            <Text style={styles.trustLabel}>Annonces</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Text style={styles.trustNumber}>4.8★</Text>
            <Text style={styles.trustLabel}>Note moyenne</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Text style={styles.trustNumber}>100%</Text>
            <Text style={styles.trustLabel}>Sécurisé</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'web' ? 72 : 64,
    paddingBottom: Platform.OS === 'web' ? 40 : 32,
    justifyContent: 'center',
  },
  heroSection: {
    marginBottom: 32,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  badge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
    letterSpacing: 0.3,
  },
  headline: {
    fontSize: 34,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    lineHeight: 42,
    marginBottom: 16,
  },
  headlineAccent: {
    color: Colors.primaryDark,
  },
  subline: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    lineHeight: 23,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 36,
  },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  catIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
  },
  actionsSection: {
    gap: 16,
    marginBottom: 36,
  },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primaryDark,
    height: 56,
    borderRadius: 16,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  mainBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  loginText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    textDecorationLine: 'underline',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trustDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.borderLight,
  },
  trustNumber: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
  },
  trustLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
});
