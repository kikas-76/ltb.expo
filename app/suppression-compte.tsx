// Page publique exigée par Google Play (Sécurité des données → « URL de
// suppression du compte ») : elle doit expliquer, sans réinstaller l'app, comment
// demander la suppression du compte et ce qui est supprimé ou conservé.
// Le contenu suit supabase/functions/delete-user-account (anonymisation du
// profil, blocage tant qu'une location est en cours) et la politique de
// confidentialité (app/legal.tsx).
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Linking, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

const STEPS = [
  "Connectez-vous à l'application LoueTonBien (iPhone ou Android) ou sur app.louetonbien.fr.",
  'Ouvrez l\'onglet Mon Compte, puis Paramètres du compte.',
  'Touchez « Supprimer mon compte », tapez SUPPRIMER puis confirmez.',
];

const DELETED = [
  'Votre profil : nom, pseudo, photo, adresse email, téléphone et adresse.',
  'Vos annonces et leurs photos, ainsi que vos favoris.',
  'Le contenu des messages que vous avez envoyés.',
  "Votre accès : il n'est plus possible de se connecter au compte.",
];

const KEPT = [
  "L'historique de vos réservations et paiements, anonymisé (sans nom, email ni téléphone), conservé 10 ans pour nos obligations comptables et fiscales.",
];

function Bullets({ items, icon, color }: { items: string[]; icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={styles.bullets}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Ionicons name={icon} size={16} color={color} style={styles.bulletIcon} />
          <Text style={styles.paragraph}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AccountDeletionScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const mail = () =>
    Linking.openURL('mailto:admin@louetonbien.fr?subject=' + encodeURIComponent('Suppression de compte'));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7} accessibilityLabel="Retour">
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suppression du compte</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }, isDesktop && styles.scrollDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Supprimer votre compte LoueTonBien</Text>
          <Text style={styles.heroSubtitle}>
            Vous pouvez supprimer votre compte LoueTonBien et vos données à tout moment, gratuitement. LoueTonBien est
            édité par LOUETONBIEN SAS.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Depuis l'application ou le site</Text>
          {STEPS.map((step, i) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.paragraph}>{step}</Text>
            </View>
          ))}
          <Text style={styles.note}>
            La suppression est immédiate. Si une location est en cours (payée, en cours, retour à valider ou litige),
            terminez-la d'abord : la suppression reste bloquée tant qu'un paiement est en jeu.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Par email</Text>
          <Text style={styles.paragraph}>
            Écrivez à{' '}
            <Text style={styles.link} onPress={mail}>
              admin@louetonbien.fr
            </Text>{' '}
            depuis l'adresse de votre compte, avec pour objet « Suppression de compte ». Nous traitons la demande sous un
            mois au plus.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ce qui est supprimé</Text>
          <Bullets items={DELETED} icon="trash-outline" color={Colors.error} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ce qui est conservé</Text>
          <Bullets items={KEPT} icon="archive-outline" color={Colors.primaryDark} />
        </View>
      </ScrollView>
    </View>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  android: { elevation: 2 },
  web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { position: 'absolute', left: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 17, color: Colors.text, letterSpacing: -0.3 },
  scroll: { padding: 20, gap: 14 },
  scrollDesktop: { maxWidth: 680, alignSelf: 'center', width: '100%', paddingHorizontal: 40 },
  hero: { paddingVertical: 12, gap: 8 },
  heroTitle: { fontFamily: 'Inter-Bold', fontSize: 22, color: Colors.text, letterSpacing: -0.4 },
  heroSubtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 12, ...shadow },
  cardTitle: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: Colors.text },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: 'Inter-Bold', fontSize: 12, color: Colors.white },
  paragraph: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
  note: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  link: { fontFamily: 'Inter-SemiBold', color: Colors.primaryDark, ...Platform.select({ web: { cursor: 'pointer' } }) },
  bullets: { gap: 10 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletIcon: { marginTop: 2 },
});
