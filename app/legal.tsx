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
    lastUpdated: 'Mise à jour le 3 avril 2026',
    content: [
      "En utilisant l'application LoueTonBien, vous acceptez les présentes conditions d'utilisation dans leur intégralité.",
      "LoueTonBien est une plateforme de mise en relation entre particuliers et/ou professionnels souhaitant louer des objets. LoueTonBien agit uniquement en tant qu'intermédiaire technique au sens de l'article 6-I-2 de la loi n° 2004-575 du 21 juin 2004 (LCEN) et n'est pas partie aux contrats de location conclus entre utilisateurs.",
      "L'inscription est réservée aux personnes physiques majeures (18 ans et plus) ou aux personnes morales dûment représentées.",
      "Vous vous engagez à fournir des informations exactes et à jour lors de votre inscription et lors de la création d'annonces. Toute information fausse ou trompeuse pourra entraîner la suspension du compte.",
      "LoueTonBien prélève une commission de 8 % sur le montant reversé au propriétaire, et applique des frais de service de 7 % au locataire, ajoutés au prix affiché. Ces frais sont clairement indiqués avant toute confirmation de paiement.",
      "Les paiements sont sécurisés par Stripe Payments Europe, Ltd., établissement de monnaie électronique agréé. LoueTonBien n'encaisse ni ne conserve les fonds des utilisateurs.",
      "Un système de caution peut être mis en place pour certaines locations. Le montant de la caution est bloqué sur la carte du locataire pendant la durée de la location et libéré après restitution de l'objet en bon état.",
      "Les locations conclues entre particuliers ne sont pas soumises au droit de rétractation de 14 jours prévu aux articles L. 221-18 et suivants du Code de la consommation. L'annulation d'une réservation acceptée est soumise aux conditions définies dans l'application.",
      "Chaque utilisateur est identifié comme particulier ou professionnel. Le statut du loueur est indiqué sur l'annonce. Les droits applicables (notamment en matière de garanties) varient selon ce statut.",
      "Le classement des annonces sur la page d'accueil et dans les résultats de recherche est basé sur la date de publication, la proximité géographique et la popularité (nombre de vues et de réservations). Aucun paiement ne permet d'influencer le classement.",
      "LoueTonBien se réserve le droit de suspendre ou supprimer tout compte en cas d'utilisation frauduleuse, abusive ou contraire aux présentes conditions, après notification à l'utilisateur.",
      "En cas de litige entre utilisateurs non résolu à l'amiable, vous pouvez recourir gratuitement à un médiateur de la consommation conformément à l'article L. 612-1 du Code de la consommation. Coordonnées disponibles sur demande à : admin@louetonbien.fr.",
      "Les présentes conditions sont régies par le droit français. Tout litige relève de la compétence des tribunaux français.",
    ],
  },
  {
    id: 'privacy',
    icon: <Ionicons name="lock-closed-outline" size={18} color={Colors.primaryDark} />,
    title: 'Politique de confidentialité',
    lastUpdated: 'Mise à jour le 3 avril 2026',
    content: [
      "LOUETONBIEN, SAS au capital de 400 €, immatriculée sous le SIREN 988 872 081, dont le siège social est situé au 7 rue Alphonse de Lamartine, 76530 Grand-Couronne, est responsable du traitement de vos données personnelles au sens du Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679).",
      "Données collectées : adresse email, nom d'utilisateur, numéro de téléphone (facultatif), adresse postale (facultatif), photo de profil (facultatif), données de géolocalisation approximative, données de transaction (montants, dates, objets loués). Pour les loueurs professionnels : numéro SIREN, nom commercial.",
      "Bases légales : exécution du contrat (article 6.1.b du RGPD) pour le fonctionnement du service ; intérêt légitime (article 6.1.f) pour la sécurité et la prévention de la fraude ; obligation légale (article 6.1.c) pour la conservation des données de transaction.",
      "Destinataires : vos données sont partagées avec Stripe (paiements — Irlande), Supabase (hébergement — UE/Singapour), Google Maps (géolocalisation — USA). Ces sous-traitants sont soumis à des clauses contractuelles types conformes au RGPD pour les transferts hors UE.",
      "Durée de conservation : données de compte : durée d'utilisation du service + 3 ans après dernière activité. Données de transaction : 10 ans (obligation comptable). Données de connexion : 1 an.",
      "Vos droits (articles 15 à 22 du RGPD) : accès, rectification, effacement, portabilité, limitation du traitement, opposition. Pour exercer vos droits : admin@louetonbien.fr. Délai de réponse : 1 mois maximum.",
      "Vous pouvez demander la suppression de votre compte et de vos données en écrivant à admin@louetonbien.fr. La suppression sera effective sous 30 jours, sous réserve des obligations légales de conservation.",
      "Vous disposez du droit d'introduire une réclamation auprès de la CNIL : Commission Nationale de l'Informatique et des Libertés, 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — www.cnil.fr.",
      "LoueTonBien utilise uniquement des cookies strictement nécessaires (authentification, session). Aucun cookie publicitaire ou de suivi n'est utilisé. Ces cookies sont exemptés de consentement en application de l'article 82 de la loi Informatique et Libertés.",
    ],
  },
  {
    id: 'mentions',
    icon: <Ionicons name="scale-outline" size={18} color={Colors.primaryDark} />,
    title: 'Mentions légales',
    lastUpdated: 'Mise à jour le 3 avril 2026',
    content: [
      "Éditeur : LOUETONBIEN, société par actions simplifiée (SAS) au capital de 400 €.",
      "SIREN : 988 872 081 — RCS Rouen.",
      "Siège social : 7 rue Alphonse de Lamartine, 76530 Grand-Couronne, France.",
      "Président et directeur de la publication : David-Bohneur FOLIER.",
      "Directeur général : Eliel Samuel DELRUE.",
      "Contact : admin@louetonbien.fr.",
      "TVA : non applicable (article 293 B du CGI — franchise en base de TVA).",
      "Hébergement : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis. Base de données : Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992.",
      "Prestataire de paiement : Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irlande — établissement de monnaie électronique agréé par la Banque centrale d'Irlande.",
      "Conformément à l'article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), les présentes mentions sont portées à la connaissance des utilisateurs.",
    ],
  },
  {
    id: 'fiscal',
    icon: <Ionicons name="cash-outline" size={18} color={Colors.primaryDark} />,
    title: 'Obligations fiscales des utilisateurs',
    lastUpdated: 'Mise à jour le 3 avril 2026',
    content: [
      "Conformément à l'article 242 bis du Code général des impôts, LoueTonBien informe ses utilisateurs que les revenus tirés de la location d'objets entre particuliers sont susceptibles d'être imposables.",
      "LoueTonBien transmet chaque année à l'administration fiscale un récapitulatif des transactions réalisées par chaque utilisateur ayant perçu des revenus via la plateforme, incluant le montant brut des transactions et le nombre de transactions réalisées.",
      "En tant que loueur occasionnel, vos revenus de location sont à déclarer dans la catégorie des Bénéfices Industriels et Commerciaux (BIC). Si vos recettes annuelles ne dépassent pas 77 700 €, vous pouvez bénéficier du régime micro-BIC avec un abattement forfaitaire de 50 %.",
      "LoueTonBien ne fournit pas de conseil fiscal personnalisé. Pour toute question relative à votre situation fiscale, consultez le site impots.gouv.fr ou un professionnel qualifié.",
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
            <Text style={styles.footerLink}>admin@louetonbien.fr</Text>
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
