import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useDeepLink } from '@/contexts/DeepLinkContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { PRELAUNCH_MODE } from '@/lib/launchConfig';

const { width } = Dimensions.get('window');

const STEPS = [
  {
    icon: 'location-outline',
    title: 'Cherche un objet',
    desc: "Trouve l'objet dont tu as besoin près de chez toi",
    num: '01',
  },
  {
    icon: 'chatbubble-outline',
    title: 'Contacte & réserve',
    desc: 'Échange avec le propriétaire et paye en toute sécurité',
    num: '02',
  },
  {
    icon: 'cube-outline',
    title: 'Récupère & profite',
    desc: 'Utilise ton objet en toute tranquillité, protégé par la plateforme',
    num: '03',
  },
];

export default function OnboardingWelcomeScreen() {
  const { pendingListingId, setPendingListingId } = useDeepLink();
  const { user, refreshProfile } = useAuth();
  const headerAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkRotate = useRef(new Animated.Value(-30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleSlide = useRef(new Animated.Value(20)).current;
  const dividerWidth = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(0.9)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  // Single useRef holding the per-step Animated.Value triplet, so we don't
  // call useRef inside a .map() (rules-of-hooks). STEPS is module-constant
  // so this initializer runs exactly once per component instance.
  const stepAnims = useRef(
    STEPS.map(() => ({
      opacity: new Animated.Value(0),
      slide: new Animated.Value(30),
      iconScale: new Animated.Value(0.6),
    })),
  ).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(checkScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 55,
          friction: 5,
        }),
        Animated.timing(checkRotate, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(50),
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(subtitleSlide, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(dividerWidth, { toValue: 60, duration: 600, useNativeDriver: false }),
      ]),
    ]).start();

    STEPS.forEach((_, i) => {
      Animated.sequence([
        Animated.delay(700 + i * 150),
        Animated.parallel([
          Animated.timing(stepAnims[i].opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(stepAnims[i].slide, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.spring(stepAnims[i].iconScale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 70,
            friction: 7,
          }),
        ]),
      ]).start();
    });

    Animated.sequence([
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      ]),
    ]).start();
  }, []);

  const checkRotateInterp = checkRotate.interpolate({
    inputRange: [-30, 0],
    outputRange: ['-30deg', '0deg'],
  });

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={[
          styles.headerSection,
          { opacity: headerAnim },
        ]}
      >
        <View style={styles.headerGradientTop} />

        <Animated.View
          style={[
            styles.checkCircleOuter,
            {
              transform: [{ scale: checkScale }, { rotate: checkRotateInterp }],
            },
          ]}
        >
          <View style={styles.checkCircleInner}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        </Animated.View>

        <Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <View style={styles.contentCard}>
        <Animated.View
          style={[
            styles.titleWrap,
            { opacity: titleOpacity, transform: [{ translateY: titleSlide }] },
          ]}
        >
          <Text style={styles.title}>Bienvenue !</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.subtitleWrap,
            { opacity: subtitleOpacity, transform: [{ translateY: subtitleSlide }] },
          ]}
        >
          <Animated.View style={[styles.divider, { width: dividerWidth }]} />
          <Text style={styles.subtitle}>
            Votre compte a été créé avec succès.{'\n'}Vous êtes maintenant prêt à louer et prêter
            vos objets en toute confiance.
          </Text>
        </Animated.View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>Comment ça marche ?</Text>
          <View style={styles.sectionDot} />
        </View>

        <View style={styles.stepsList}>
          {STEPS.map((step, i) => {
            return (
              <Animated.View
                key={i}
                style={[
                  styles.stepCard,
                  {
                    opacity: stepAnims[i].opacity,
                    transform: [{ translateY: stepAnims[i].slide }],
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.stepIconWrap,
                    { transform: [{ scale: stepAnims[i].iconScale }] },
                  ]}
                >
                  <Ionicons name={step.icon as any} size={22} color={Colors.primary} />
                  <View style={styles.stepNumBadge}>
                    <Text style={styles.stepNum}>{step.num}</Text>
                  </View>
                </Animated.View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View
          style={[
            styles.btnWrap,
            { opacity: btnOpacity, transform: [{ scale: btnScale }] },
          ]}
        >
          <TouchableOpacity
            style={styles.btn}
            onPress={async () => {
              if (user) {
                await supabase
                  .from('profiles')
                  .update({ onboarding_completed: true })
                  .eq('id', user.id);
                await refreshProfile();
              }
              if (PRELAUNCH_MODE) {
                // Drop any deferred deep link during prelaunch: target
                // routes are blocked and would bounce to mes-annonces anyway.
                if (pendingListingId) setPendingListingId(null);
                router.replace('/(tabs)/mes-annonces' as any);
              } else if (pendingListingId) {
                const id = pendingListingId;
                setPendingListingId(null);
                router.replace(`/listing/${id}` as any);
              } else {
                router.replace('/(tabs)');
              }
            }}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>Commencer à explorer</Text>
            <View style={styles.btnArrowCircle}>
              <Text style={styles.btnArrow}>→</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 40,
  },
  headerSection: {
    width: '100%',
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 52,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: '#8E9878',
    opacity: 0.35,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
  },
  checkCircleOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  checkCircleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  checkMark: {
    fontSize: 30,
    color: Colors.primary,
    fontWeight: '800',
    lineHeight: 36,
  },
  logo: {
    width: 220,
    height: 52,
    tintColor: '#FFFFFF',
  },
  contentCard: {
    width: Math.min(width - 24, 420),
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: Colors.text,
    letterSpacing: -0.8,
  },
  subtitleWrap: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 14,
  },
  divider: {
    height: 3,
    backgroundColor: Colors.primaryDark,
    borderRadius: 2,
  },
  subtitle: {
    fontSize: 14.5,
    fontFamily: 'Inter-Regular',
    color: '#6B6B60',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryDark,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    letterSpacing: 0.2,
  },
  stepsList: {
    width: '100%',
    gap: 12,
    marginBottom: 36,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E8E2D6',
    shadowColor: '#8E9878',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  stepIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  stepNumBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    lineHeight: 11,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14.5,
    fontFamily: 'Inter-SemiBold',
    color: Colors.text,
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 12.5,
    fontFamily: 'Inter-Regular',
    color: '#6B6B60',
    lineHeight: 18,
  },
  btnWrap: {
    width: '100%',
  },
  btn: {
    backgroundColor: Colors.primary,
    height: 58,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 7,
  },
  btnText: {
    color: '#fff',
    fontSize: 16.5,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  btnArrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnArrow: {
    fontSize: 18,
    color: '#fff',
    lineHeight: 22,
  },
});
