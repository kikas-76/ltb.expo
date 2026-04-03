import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  LayoutAnimation,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LegalSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  lastUpdated: string;
  content: string[];
}

const LEGAL_SECTIONS: LegalSection[] = [
  {
    id: 'cgu',
    icon: <Ionicons name="document-text-outline" size={18} color={Colors.primaryDark} />,
    title: "Conditions Générales d'Utilisation",
    lastUpdated: 'Mise à jour le 1er janvier 2025',
    content: [
      "En utilisant l'application LockThatBox, vous acceptez les présentes conditions d'utilisation dans leur intégralité.",
      "L'application met en relation des propriétaires d'objets et des locataires. LockThatBox agit uniquement en tant qu'intermédiaire et ne peut être tenu responsable des transactions entre utilisateurs.",
      "Vous vous engagez à fournir des informations exactes et à jour lors de votre inscription et lors de la création d'annonces.",
      "Toute utilisation frauduleuse, abusive ou contraire aux présentes conditions entraînera la suspension immédiate du compte concerné.",
      "LockThatBox se réserve le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront notifiés de tout changement significatif.",
      "L'utilisation de l'application est réservée aux personnes majeures (18 ans et plus) ou aux mineurs avec l'accord de leurs représentants légaux.",
    ],
  },
  {
    id: 'privacy',
    icon: <Ionicons name="lock-closed-outline" size={18} color={Colors.primaryDark} />,
    title: 'Politique de confidentialité',
    lastUpdated: 'Mise à jour le 1er janvier 2025',
    content: [
      "LockThatBox collecte uniquement les données nécessaires au bon fonctionnement du service : email, nom d'utilisateur, numéro de téléphone (facultatif), adresse (facultatif) et photo de profil (facultatif).",
      "Vos données personnelles ne sont jamais vendues à des tiers. Elles peuvent être partagées avec nos prestataires techniques dans le strict cadre de la fourniture du service.",
      "Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données.",
      "Pour exercer vos droits, contactez notre délégué à la protection des données à : privacy@lockthatbox.com",
      "Nous utilisons des cookies et technologies similaires pour améliorer votre expérience. Vous pouvez configurer vos préférences depuis les paramètres de votre appareil.",
      "Vos données sont conservées pendant la durée de votre utilisation du service, puis supprimées dans un délai de 30 jours après la clôture du compte.",
    ],
  },
  {
    id: 'mentions',
    icon: <Ionicons name="scale-outline" size={18} color={Colors.primaryDark} />,
    title: 'Mentions légales',
    lastUpdated: 'Mise à jour le 1er janvier 2025',
    content: [
      "LockThatBox est une application éditée par la société LTB SAS, société par actions simplifiée au capital de 10 000 €.",
      "Siège social : 12 rue de l'Innovation, 75001 Paris, France.",
      "RCS Paris : 123 456 789 — TVA intracommunautaire : FR 12 123456789.",
      "Directeur de la publication : Jean Dupont.",
      "Hébergement : les données sont hébergées par Supabase Inc., conforme aux réglementations européennes RGPD.",
      "Pour toute question : contact@lockthatbox.com",
    ],
  },
  {
    id: 'cookies',
    icon: <Ionicons name="shield-outline" size={18} color={Colors.primaryDark} />,
    title: 'Gestion des cookies',
    lastUpdated: 'Mise à jour le 1er janvier 2025',
    content: [
      "LockThatBox utilise des cookies essentiels pour assurer le fonctionnement de l'application (authentification, préférences).",
      "Des cookies analytiques anonymisés nous permettent de comprendre comment l'application est utilisée afin de l'améliorer.",
      "Aucun cookie publicitaire ou de tracking tiers n'est utilisé sans votre consentement explicite.",
      "Vous pouvez à tout moment désactiver les cookies non essentiels depuis les paramètres de votre appareil ou de votre navigateur.",
      "La désactivation des cookies essentiels peut altérer le fonctionnement de l'application.",
    ],
  },
];

function LegalCard({ section }: { section: LegalSection }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen((v) => !v);
  };

  return (
    <View style={cardStyles.card}>
      <TouchableOpacity style={cardStyles.header} onPress={toggle} activeOpacity={0.7}>
        <View style={cardStyles.iconWrap}>{section.icon}</View>
        <View style={cardStyles.titleBlock}>
          <Text style={cardStyles.title}>{section.title}</Text>
          <Text style={cardStyles.updated}>{section.lastUpdated}</Text>
        </View>
        {open ? (
          <Ionicons name="chevron-up-outline" size={18} color={Colors.primaryDark} />
        ) : (
          <Ionicons name="chevron-down-outline" size={18} color={Colors.textMuted} />
        )}
      </TouchableOpacity>
      {open && (
        <View style={cardStyles.body}>
          <View style={cardStyles.divider} />
          {section.content.map((paragraph, i) => (
            <Text key={i} style={cardStyles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

export default function LegalScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informations légales</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="shield-outline" size={32} color={Colors.primaryDark} />
          </View>
          <Text style={styles.heroTitle}>Transparence & conformité</Text>
          <Text style={styles.heroSubtitle}>
            Consultez nos documents légaux. Appuyez sur chaque section pour en savoir plus.
          </Text>
        </View>

        <View style={styles.list}>
          {LEGAL_SECTIONS.map((section) => (
            <LegalCard key={section.id} section={section} />
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Pour toute question relative à vos droits ou à nos pratiques légales, contactez-nous à{' '}
            <Text style={styles.footerLink}>legal@lockthatbox.com</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  scroll: {
    padding: 20,
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
  list: {
    gap: 12,
  },
  footer: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
    }),
  },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.primaryDark,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight + '40',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  updated: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 0,
    marginBottom: 16,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  paragraph: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
