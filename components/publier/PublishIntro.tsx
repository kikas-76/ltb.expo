import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { EmptyIllustration } from '@/components/EmptyIllustration';

const POINTS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'pricetag-outline',
    title: 'Publication gratuite',
    text: 'Une commission de 8 % seulement quand vous louez.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'Paiement sécurisé en ligne',
    text: 'Le locataire paie sur LoueTonBien avant de récupérer l\'objet.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Vous gardez la main',
    text: 'Vous acceptez chaque demande, et une caution peut protéger votre objet.',
  },
];

/** Accueil du lien /publier : présente LoueTonBien à quelqu'un qui ne connaît pas. */
export default function PublishIntro({
  hasDraft,
  onStart,
  onRestart,
  onSignIn,
}: {
  hasDraft: boolean;
  onStart: () => void;
  onRestart: () => void;
  onSignIn?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.inner}>
        <Image
          source={require('@/assets/images/logoLTBwhitoutbaground.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <EmptyIllustration name="box" size={120} />
        <Text style={styles.title}>Vos objets qui dorment peuvent vous rapporter de l'argent</Text>
        <Text style={styles.subtitle}>
          LoueTonBien, c'est la location d'objets entre voisins. Publiez votre annonce en 2 minutes,
          sans créer de compte avant la fin.
        </Text>

        <View style={styles.points}>
          {POINTS.map((p) => (
            <View key={p.title} style={styles.point}>
              <View style={styles.pointIcon}>
                <Ionicons name={p.icon} size={18} color={Colors.primaryDark} />
              </View>
              <View style={styles.pointBody}>
                <Text style={styles.pointTitle}>{p.title}</Text>
                <Text style={styles.pointText}>{p.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.cta} onPress={onStart} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{hasDraft ? 'Reprendre mon annonce' : 'Publier mon objet'}</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.white} />
        </TouchableOpacity>
        {hasDraft && (
          <TouchableOpacity onPress={onRestart} style={styles.linkBtn} activeOpacity={0.6}>
            <Text style={styles.linkText}>Recommencer une nouvelle annonce</Text>
          </TouchableOpacity>
        )}
        {onSignIn && (
          <TouchableOpacity onPress={onSignIn} style={styles.linkBtn} activeOpacity={0.6}>
            <Text style={styles.signInText}>
              Déjà un compte ? <Text style={styles.signInBold}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, paddingHorizontal: 20, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 440, alignItems: 'center', gap: 14 },
  logo: { width: 150, height: 44, marginBottom: 4 },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.5,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15.5,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  points: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pointIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointBody: { flex: 1 },
  pointTitle: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.text },
  pointText: { fontFamily: 'Inter-Regular', fontSize: 13.5, lineHeight: 19, color: Colors.textSecondary },
  cta: {
    width: '100%',
    height: 56,
    borderRadius: 999,
    backgroundColor: Colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  ctaText: { fontFamily: 'Inter-SemiBold', fontSize: 17, color: Colors.white, letterSpacing: 0.2 },
  linkBtn: { paddingVertical: 6 },
  linkText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.primaryDark,
    textDecorationLine: 'underline',
  },
  signInText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.textSecondary },
  signInBold: { fontFamily: 'Inter-SemiBold', color: Colors.primaryDark },
});
