export interface HelpQuestion {
  id: string;
  question: string;
  answer: string;
}

export interface HelpCategory {
  id: string;
  icon: string;
  title: string;
  description: string;
  questions: HelpQuestion[];
}

// Centre d'aide. Règle : ne décrire que ce que l'app fait réellement
// (App Review 2.3.1, et une politique affichée engage la plateforme).
// Contact support unique : admin@louetonbien.fr. Vouvoiement partout.

const helpData: HelpCategory[] = [
  {
    id: 'demarrer',
    icon: 'Rocket',
    title: 'Démarrer sur LoueTonBien',
    description: 'Inscription, profil et premiers pas',
    questions: [
      {
        id: 'd1',
        question: 'Comment créer mon compte ?',
        answer:
          "Créez votre compte en quelques secondes depuis l'écran d'accueil : avec votre adresse email et un mot de passe, avec votre compte Google, ou avec Apple sur iPhone. Après l'inscription, vous choisissez un pseudo et une photo, puis vous pouvez indiquer votre adresse pour voir les objets autour de vous. Cette étape peut être passée et complétée plus tard depuis Mon Compte → Paramètres du compte.",
      },
      {
        id: 'd2',
        question: 'Comment fonctionne LoueTonBien ?',
        answer:
          "LoueTonBien est une marketplace de location d'objets entre particuliers et professionnels. Vous pouvez prêter vos objets inutilisés pour gagner de l'argent, et louer ceux des autres pour éviter d'acheter. Vous trouvez un objet, vous envoyez une demande au propriétaire avec vos dates, il accepte ou refuse, puis vous payez dans l'app. La remise et le retour se confirment avec un QR code, et chacun laisse un avis à la fin.",
      },
      {
        id: 'd3',
        question: "Est-ce gratuit de s'inscrire ?",
        answer:
          "Oui, l'inscription et la publication d'annonces sont gratuites. LoueTonBien prélève une commission de 8 % sur le montant reversé au propriétaire et des frais de service de 7 % ajoutés au prix affiché pour le locataire, uniquement sur les locations réalisées. Ces frais couvrent le paiement sécurisé, la gestion de la caution et le fonctionnement de la plateforme. Ils sont affichés avant tout paiement.",
      },
      {
        id: 'd4',
        question: 'Comment vérifier mon identité ?',
        answer:
          "La vérification d'identité est réalisée par notre partenaire Stripe lorsque vous activez les paiements pour recevoir de l'argent. Stripe vous demande une pièce d'identité valide et un IBAN, directement dans l'app. Cette vérification est obligatoire pour recevoir des paiements. LoueTonBien n'a jamais accès à votre pièce d'identité ni à vos données bancaires.",
      },
      {
        id: 'd5',
        question: 'Comment ajouter ma photo de profil ?',
        answer:
          "Allez dans l'onglet Mon Compte, puis Paramètres du compte → Photo de profil. Vous pouvez choisir une photo dans votre galerie ou en prendre une. Une photo claire inspire confiance aux autres membres et les encourage à accepter vos demandes.",
      },
    ],
  },
  {
    id: 'louer',
    icon: 'Package',
    title: 'Louer un objet',
    description: 'Demandes, paiement et annulations',
    questions: [
      {
        id: 'l1',
        question: 'Comment faire une demande de location ?',
        answer:
          "Ouvrez l'annonce qui vous intéresse, choisissez vos dates, puis appuyez sur « Faire une demande ». Le récapitulatif affiche le prix de la location, les frais de service et le montant de la caution. Une conversation s'ouvre avec le propriétaire : présentez-vous et décrivez votre usage. Il reçoit une notification et accepte ou refuse la demande. Tant qu'il n'a pas répondu, vous pouvez annuler votre demande depuis l'onglet Messages.",
      },
      {
        id: 'l2',
        question: 'Comment fonctionne le paiement ?',
        answer:
          "Le paiement est sécurisé par Stripe. Quand votre demande est acceptée, réglez la location dans l'app depuis la conversation, par carte bancaire ou avec Apple Pay sur iPhone. Une fois le paiement lancé, vous avez 2 heures pour le terminer ; sans paiement avant la date de début, la demande est annulée et vous pouvez en refaire une. Seul le prix de la location (frais inclus) est débité à ce moment-là. La caution n'est pas prélevée : elle est réservée sur le moyen de paiement utilisé deux jours avant la fin de la location (ou immédiatement pour les locations de moins de deux jours).",
      },
      {
        id: 'l3',
        question: 'À quoi sert la caution ?',
        answer:
          "La caution protège le propriétaire en cas de dommage ou de perte. Son montant est indiqué sur l'annonce. Elle est seulement réservée sur votre carte, jamais débitée sauf en cas de litige avéré. Une fois le retour validé par le propriétaire (ou automatiquement 24 h après votre confirmation de retour), la réservation est levée et le montant redevient disponible sur votre carte, généralement sous 5 à 10 jours ouvrés selon votre banque.",
      },
      {
        id: 'l4',
        question: 'Que faire si le propriétaire ne répond pas ?',
        answer:
          "Le propriétaire est prévenu par email et sur son téléphone à chaque demande, et dispose de 48 heures pour répondre ; passé ce délai, la demande expire automatiquement. Vous pouvez le relancer dans la conversation, ou annuler votre demande depuis l'onglet Messages et chercher un objet similaire. Aucun paiement n'est effectué tant que la demande n'est pas acceptée. Si un membre vous semble injoignable ou suspect, vous pouvez le signaler depuis le menu « … » de son profil ou de la conversation.",
      },
      {
        id: 'l5',
        question: 'Comment annuler une réservation ?',
        answer:
          "Avant le paiement : vous pouvez annuler librement, sans frais, depuis l'onglet Messages ou depuis la conversation. Après le paiement, l'annulation n'est pas automatique : écrivez-nous à admin@louetonbien.fr en indiquant la réservation concernée. Nous étudions chaque demande avec le propriétaire et pouvons rembourser tout ou partie de la location selon la situation (délai avant le début, motif, accord du propriétaire).",
      },
      {
        id: 'l6',
        question: "Que faire si l'objet ne correspond pas à l'annonce ?",
        answer:
          "Si l'objet reçu ne correspond pas à la description (état très différent, fonctionnalité manquante, objet différent), signalez-le tout de suite au propriétaire dans la conversation, photos à l'appui. Si aucun accord n'est trouvé, ouvrez un litige depuis la conversation de la réservation ou écrivez-nous à admin@louetonbien.fr. Notre équipe examine les échanges et les photos et peut décider d'un remboursement total ou partiel.",
      },
      {
        id: 'l7',
        question: 'Comment signaler un problème pendant ou après la location ?',
        answer:
          "Pendant la location, vous pouvez ouvrir un litige depuis la conversation de la réservation, avec des photos et une description. Après le retour, tant que le propriétaire n'a pas validé, le bouton de litige reste disponible. Une fois la location terminée, laissez un avis pour informer les autres membres et contactez-nous à admin@louetonbien.fr si un problème persiste.",
      },
    ],
  },
  {
    id: 'preter',
    icon: 'Infinity',
    title: 'Prêter un objet',
    description: 'Annonces, gains et gestion',
    questions: [
      {
        id: 'p1',
        question: 'Comment publier une annonce ?',
        answer:
          "Appuyez sur l'onglet Louer dans la barre de navigation. Le formulaire vous guide : titre et description, catégorie, prix par jour et montant de la caution, photos (une au minimum, idéalement trois ou quatre sous différents angles) et lieu de remise. Vous voyez en direct une estimation de ce que vous toucherez. Plus l'annonce est complète et illustrée, plus elle reçoit de demandes.",
      },
      {
        id: 'p2',
        question: 'Comment fixer mon prix ?',
        answer:
          "Un repère simple : entre 3 % et 8 % de la valeur neuve de l'objet par jour. Pour un vélo qui vaut 400 €, un prix entre 12 € et 32 € par jour est cohérent. Regardez aussi les annonces similaires sur LoueTonBien pour vous positionner. La commission de 8 % est déduite de ce que vous recevez : à 20 € par jour affichés, vous touchez 18,40 €. Le montant exact est indiqué dans le formulaire.",
      },
      {
        id: 'p3',
        question: "Comment activer les paiements pour recevoir de l'argent ?",
        answer:
          "Allez dans Mon Compte → Mon portefeuille → Activer mon compte. Notre partenaire Stripe vous demande, directement dans l'app, vos informations personnelles, une pièce d'identité et votre IBAN. Comptez 5 à 10 minutes. Une fois votre compte validé par Stripe, vous pouvez accepter des demandes payantes. Sans cette activation, vous pouvez publier des annonces, mais vos demandes ne pourront pas être payées.",
      },
      {
        id: 'p4',
        question: 'Comment accepter ou refuser une demande ?',
        answer:
          "Chaque demande vous parvient par notification et dans l'onglet Messages. Vous pouvez lire le message du locataire, consulter son profil et ses avis, et lui poser des questions dans la conversation avant de décider. Appuyez sur Accepter ou Refuser, dans les 48 heures. Si vous acceptez, le locataire peut payer dans l'app ; la réservation devient définitive une fois le paiement confirmé.",
      },
      {
        id: 'p5',
        question: 'Quand est-ce que je reçois mon argent ?',
        answer:
          "Dès que le locataire paie, le montant (commission déduite) est transféré sur votre compte Stripe. Les fonds deviennent disponibles 14 jours après le paiement, puis Stripe les vire automatiquement sur votre compte bancaire selon son calendrier. Vous suivez vos gains dans Mon portefeuille et vous gérez vos virements depuis « Gérer mon compte Stripe ».",
      },
      {
        id: 'p6',
        question: 'Comment fonctionne la caution en cas de dommage ?',
        answer:
          "Au retour de l'objet, vérifiez son état avant de valider. Si vous constatez un dommage, ouvrez un litige depuis la conversation, avec des photos et une estimation du coût de réparation, avant de valider le retour. Sans action de votre part, le retour est validé automatiquement 24 h après la confirmation du locataire et la caution est levée. En cas de litige, notre équipe examine le dossier et peut prélever tout ou partie de la caution.",
      },
      {
        id: 'p7',
        question: 'Comment masquer temporairement une annonce ?',
        answer:
          "Allez dans Mon Compte → Mes annonces, ouvrez l'annonce concernée et désactivez-la. Une annonce inactive n'apparaît plus dans l'accueil ni dans la recherche et ne reçoit plus de demandes. Les réservations déjà acceptées restent valables. Vous pouvez la réactiver à tout moment.",
      },
    ],
  },
  {
    id: 'paiements',
    icon: 'CreditCard',
    title: 'Paiements & Caution',
    description: 'Débits, remboursements et commissions',
    questions: [
      {
        id: 'pay1',
        question: 'Quand suis-je débité en tant que locataire ?',
        answer:
          "Une seule fois, au moment où vous payez après l'acceptation de votre demande : le prix de la location plus les frais de service. La caution n'est pas débitée. Elle est réservée sur votre carte deux jours avant la fin de la location (immédiatement si la location dure moins de deux jours) et levée après validation du retour.",
      },
      {
        id: 'pay2',
        question: 'Comment fonctionne la caution exactement ?',
        answer:
          "Comme une empreinte de carte bancaire à l'hôtel : le montant apparaît « en attente » dans votre application bancaire mais n'est pas encaissé. Il n'est prélevé qu'en cas de litige avéré, après examen par notre équipe. Si la carte ne permet pas de réserver la caution, le locataire et le propriétaire en sont informés pour trouver une solution.",
      },
      {
        id: 'pay3',
        question: 'La caution est-elle vraiment prélevée ?',
        answer:
          "Non, sauf litige avéré. Elle reste réservée sur votre carte pendant la fin de la location et ne passe jamais sur le compte du propriétaire ni de LoueTonBien tant que tout se déroule normalement. Une fois le retour validé, la réservation est levée et le montant redevient disponible sur votre carte, généralement sous 5 à 10 jours ouvrés selon votre banque.",
      },
      {
        id: 'pay4',
        question: 'Dans quel délai la caution est-elle libérée ?',
        answer:
          "La caution est levée dès que le propriétaire valide le retour, ou automatiquement 24 h après votre confirmation de retour s'il ne réagit pas. La banque met ensuite quelques jours à faire réapparaître le montant sur votre compte, jusqu'à 10 jours ouvrés selon les établissements. Si ce n'est pas le cas passé ce délai, écrivez-nous à admin@louetonbien.fr.",
      },
      {
        id: 'pay5',
        question: 'Comment obtenir un remboursement ?',
        answer:
          "Avant paiement, il n'y a rien à rembourser : une demande annulée ou refusée n'est jamais débitée. Après paiement, les remboursements ne sont pas automatiques : écrivez-nous à admin@louetonbien.fr avec la réservation concernée. Nous examinons chaque cas (annulation, objet non conforme, litige) avec les deux parties et le remboursement, total ou partiel, apparaît sur votre carte sous 5 à 10 jours ouvrés après notre décision.",
      },
      {
        id: 'pay6',
        question: 'Quels moyens de paiement sont acceptés ?',
        answer:
          "Les cartes bancaires Visa, Mastercard et American Express, ainsi qu'Apple Pay sur iPhone, via Stripe. Les paiements en espèces, par virement direct ou par chèque ne sont pas autorisés sur la plateforme : ils ne permettent pas de protéger les deux parties en cas de litige et ne sont pas couverts par la caution.",
      },
      {
        id: 'pay7',
        question: 'Combien prend LoueTonBien de commission ?',
        answer:
          "Deux frais, affichés avant tout paiement. Le propriétaire verse une commission de 8 % sur le montant de la location, déduite automatiquement de son versement. Le locataire paie des frais de service de 7 % ajoutés au prix affiché. Pour une location à 40 € par jour : le locataire paie 42,80 € et le propriétaire reçoit 36,80 €.",
      },
      {
        id: 'pay8',
        question: 'Où voir mes gains en tant que propriétaire ?',
        answer:
          "Dans Mon Compte → Mon portefeuille : total du mois, historique et détail de chaque transaction. Pour les virements, les relevés et les documents fiscaux, ouvrez votre tableau de bord Stripe depuis « Gérer mon compte Stripe ». Stripe conserve l'ensemble de vos données financières.",
      },
    ],
  },
  {
    id: 'securite',
    icon: 'ShieldCheck',
    title: 'Confiance & Sécurité',
    description: 'Protection, litiges et signalements',
    questions: [
      {
        id: 's1',
        question: 'Mes données bancaires sont-elles sécurisées ?',
        answer:
          "Oui. LoueTonBien ne stocke jamais vos données bancaires. Tous les paiements sont traités par Stripe, certifié PCI-DSS niveau 1, le niveau de sécurité le plus élevé du secteur. Ni votre numéro de carte ni votre IBAN ne transitent par nos serveurs.",
      },
      {
        id: 's2',
        question: 'Comment sont vérifiés les utilisateurs ?',
        answer:
          "Chaque propriétaire qui reçoit des paiements passe par la vérification d'identité de Stripe (pièce d'identité et coordonnées bancaires). Les profils affichent les avis laissés après chaque location, la date d'inscription et le statut particulier ou professionnel. Vous pouvez aussi poser vos questions dans la conversation avant de payer.",
      },
      {
        id: 's3',
        question: "Que faire si je ne reçois pas l'objet ?",
        answer:
          "Si le propriétaire ne se présente pas ou ne remet pas l'objet, ne payez jamais en dehors de la plateforme et écrivez-nous à admin@louetonbien.fr avec la réservation concernée. Nous pouvons rembourser la location, lever la caution et suspendre le compte du propriétaire après vérification.",
      },
      {
        id: 's4',
        question: 'Comment signaler ou bloquer un utilisateur ?',
        answer:
          "Sur le profil d'un membre ou dans une conversation, appuyez sur le menu « … » en haut à droite. Vous pouvez signaler l'utilisateur ou la conversation en précisant le motif (harcèlement, arnaque, profil inapproprié, spam…), et le bloquer : une personne bloquée ne peut plus vous écrire ni réserver vos objets, et vous ne voyez plus ses annonces. Vous gérez votre liste dans Paramètres du compte → Utilisateurs bloqués. Chaque signalement est examiné par notre équipe sous 24 h ouvrées. En cas d'urgence, contactez directement les autorités.",
      },
      {
        id: 's5',
        question: 'Que faire en cas de litige ?',
        answer:
          "En cas de désaccord sur l'état de l'objet ou son retour, ouvrez un litige depuis la conversation de la réservation, avec des photos et une description. Notre équipe joue le rôle d'arbitre : elle examine les échanges et les preuves, puis décide du sort de la caution et d'un éventuel remboursement. Vous pouvez aussi nous écrire à admin@louetonbien.fr. Pour un litige non résolu, un médiateur de la consommation peut être saisi (voir les CGU).",
      },
      {
        id: 's6',
        question: 'LoueTonBien est-il responsable des objets loués ?',
        answer:
          "LoueTonBien met en relation propriétaires et locataires et n'est pas propriétaire des objets. La caution est la première protection du propriétaire. Pour les objets de valeur, vérifiez que votre assurance habitation couvre le prêt d'objets entre particuliers, ce qui est souvent le cas des contrats multirisques. Le locataire reste responsable de l'objet pendant la location.",
      },
    ],
  },
];

export default helpData;
