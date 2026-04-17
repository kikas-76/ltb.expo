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
          "Crée ton compte en quelques secondes depuis l'écran d'accueil. Tu peux t'inscrire avec ton adresse email et un mot de passe, ou directement avec ton compte Google en un seul clic. Une fois inscrit, tu seras invité à compléter ton profil avec ton prénom, une photo et ton adresse principale.",
      },
      {
        id: 'd2',
        question: 'Comment fonctionne LoueTonBien ?',
        answer:
          "LoueTonBien est une marketplace de location d'objets entre particuliers. Tu peux à la fois prêter tes objets inutilisés pour gagner de l'argent, et louer les objets des autres pour éviter d'acheter. Le fonctionnement est simple : tu trouves un objet, tu envoies une demande au loueur avec un message de présentation, il accepte ou refuse, et le paiement se fait automatiquement et en toute sécurité via notre partenaire Stripe.",
      },
      {
        id: 'd3',
        question: "Est-ce gratuit de s'inscrire ?",
        answer:
          "Oui, l'inscription sur LoueTonBien est entièrement gratuite. LoueTonBien applique une commission de 8 % sur le montant reversé au propriétaire, et des frais de service de 7 % ajoutés au prix affiché pour le locataire uniquement sur les transactions réalisées. Cette commission couvre les frais de paiement sécurisé, la protection des transactions et la maintenance de la plateforme. En tant que loueur, tu reçois 92 % du prix de location que tu as fixé (8 % de commission plateforme).",
      },
      {
        id: 'd4',
        question: 'Comment vérifier mon identité ?',
        answer:
          "La vérification d'identité est réalisée automatiquement par notre partenaire Stripe lorsque tu actives les paiements en tant que loueur. Stripe te demandera une pièce d'identité valide (carte nationale d'identité ou passeport) et tes coordonnées bancaires (IBAN). Cette vérification est obligatoire pour recevoir des paiements et garantit la confiance sur la plateforme. Tes données sont sécurisées et jamais transmises à LoueTonBien.",
      },
      {
        id: 'd5',
        question: 'Comment ajouter ma photo de profil ?',
        answer:
          "Va dans l'onglet 'Mon Compte' en bas de l'écran, puis appuie sur ton avatar en haut de la page profil. Tu peux choisir une photo depuis ta galerie ou en prendre une nouvelle directement. Une photo de profil claire augmente significativement la confiance des autres utilisateurs et le taux d'acceptation de tes demandes.",
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
          "Trouve l'objet qui t'intéresse sur la page Explore, appuie dessus pour voir le détail, puis sélectionne tes dates de location. Un récapitulatif du prix total et de la caution s'affiche automatiquement. Écris un message de présentation au loueur (obligatoire, présente-toi brièvement et explique ton usage de l'objet), puis appuie sur 'Envoyer la demande'. Le loueur a 48h pour accepter ou refuser.",
      },
      {
        id: 'l2',
        question: 'Comment fonctionne le paiement ?',
        answer:
          "Le paiement est sécurisé par Stripe, leader mondial du paiement en ligne. Lorsque ta demande est acceptée par le loueur, tu es invité à entrer ta carte bancaire. Deux montants sont alors bloqués sur ta carte : le prix de la location (débité immédiatement) et la caution (simplement mise en hold, non débitée). Tu reçois un reçu par email après chaque transaction.",
      },
      {
        id: 'l3',
        question: 'À quoi sert la caution ?',
        answer:
          "La caution est une garantie pour le loueur en cas de dommage ou de perte de son objet. Elle est bloquée sur ta carte bancaire pendant toute la durée de la location, mais elle n'est pas débitée sauf incident. Si l'objet est rendu en bon état, la caution est automatiquement libérée à la fin de la location et le montant redevient disponible sur ta carte sous 5 à 10 jours ouvrés selon ta banque.",
      },
      {
        id: 'l4',
        question: 'Que faire si le loueur ne répond pas ?',
        answer:
          "Les loueurs ont 48h pour répondre à une demande. Si tu n'as pas de réponse passé ce délai, la demande est automatiquement annulée et aucun paiement n'est effectué. Tu peux relancer le loueur via la messagerie de la réservation ou chercher un objet similaire chez un autre loueur. Si tu penses que le loueur est injoignable, tu peux le signaler via le bouton 'Signaler' sur son profil.",
      },
      {
        id: 'l5',
        question: 'Comment annuler une réservation ?',
        answer:
          "Tu peux annuler une réservation depuis la page de détail de la réservation dans l'onglet 'Réservations'. Si tu annules avant que le loueur ait accepté, aucun frais n'est engagé. Si tu annules après acceptation et paiement, les conditions d'annulation s'appliquent : annulation 48h avant le début → remboursement intégral. Annulation moins de 48h avant → remboursement de 50%. Annulation le jour J → aucun remboursement. La caution est toujours intégralement remboursée en cas d'annulation.",
      },
      {
        id: 'l6',
        question: "Que faire si l'objet ne correspond pas à l'annonce ?",
        answer:
          "Si l'objet reçu ne correspond pas à la description (état très différent, fonctionnalités manquantes, objet différent), contacte immédiatement le loueur via la messagerie. Si aucun accord n'est trouvé dans les 2h suivant la remise, contacte le support LoueTonBien via le Centre d'aide avec des photos à l'appui. Nous examinerons le dossier et pourrons déclencher un remboursement total ou partiel selon la situation.",
      },
      {
        id: 'l7',
        question: 'Comment signaler un problème après la location ?',
        answer:
          "À la fin de la location, tu seras invité à confirmer le retour de l'objet et à laisser un avis. Si tu constates un problème (objet endommagé avant utilisation, dysfonctionnement non mentionné), signale-le dans les 24h suivant la remise via le bouton 'Signaler un problème' sur la page de la réservation. Joins des photos et une description précise. Notre équipe traitera ton signalement sous 48h ouvrées.",
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
          "Appuie sur le bouton '+' (Louer) dans la barre de navigation en bas. Un formulaire en 5 étapes te guide : donne un titre clair et une description détaillée de ton objet, choisis la catégorie, fixe ton prix par jour et le montant de caution, ajoute des photos (minimum 1, idéalement 3-4 sous différents angles), et indique ta localisation. Plus ton annonce est complète et illustrée, plus tu as de chances de recevoir des demandes.",
      },
      {
        id: 'p2',
        question: 'Comment fixer mon prix ?',
        answer:
          "Pour fixer un prix cohérent, nous te recommandons de prendre entre 3% et 8% de la valeur neuve de l'objet par jour de location. Par exemple, pour un vélo vaut 400€, un prix entre 12€ et 32€ par jour est raisonnable. Regarde aussi les annonces similaires sur LoueTonBien pour te positionner. N'oublie pas que LoueTonBien prend 8 % de commission : si tu affiches 20 €/jour, tu reçois 18,40 €. Le locataire paie en plus 7 % de frais de service.",
      },
      {
        id: 'p3',
        question: "Comment activer les paiements pour recevoir de l'argent ?",
        answer:
          "Va dans 'Mon Compte' → 'Mon Portefeuille' → 'Activer mon compte'. Tu seras redirigé vers notre partenaire Stripe qui te demandera tes informations personnelles et ton IBAN. Cette étape prend environ 5 à 10 minutes. Une fois validé par Stripe, tu peux recevoir des paiements. Sans cette activation, tu peux publier des annonces mais tu ne pourras pas accepter de demandes avec paiement.",
      },
      {
        id: 'p4',
        question: 'Comment accepter ou refuser une demande ?',
        answer:
          "Lorsque tu reçois une demande, tu reçois une notification push. Va dans l'onglet 'Réservations' → 'Mes prêts' pour voir la demande. Tu peux lire le message de présentation du locataire, consulter son profil et ses avis, et poser des questions via la messagerie avant de décider. Appuie sur 'Accepter' ou 'Refuser'. Si tu acceptes, le paiement est automatiquement déclenché côté locataire.",
      },
      {
        id: 'p5',
        question: "Quand est-ce que je reçois mon argent ?",
        answer:
          "Les virements sont effectués automatiquement tous les 14 jours sur ton compte bancaire. Le paiement est déclenché après confirmation du retour de l'objet par les deux parties. Le délai de virement est généralement de 1 à 3 jours ouvrés après le déclenchement selon ta banque. Tu peux suivre l'état de tes gains dans 'Mon Portefeuille' et gérer tes paramètres de virement depuis ton tableau de bord Stripe.",
      },
      {
        id: 'p6',
        question: 'Comment fonctionne la caution en cas de dommage ?',
        answer:
          "Si l'objet est rendu endommagé, tu as 24h après la remise pour signaler le problème via 'Signaler un dommage' sur la page de la réservation. Joins des photos claires des dommages et une estimation du coût de réparation. LoueTonBien examine le dossier et peut capturer tout ou partie de la caution pour couvrir les frais de réparation. En cas de désaccord, notre équipe arbitre la situation de manière impartiale.",
      },
      {
        id: 'p7',
        question: 'Comment désactiver temporairement une annonce ?',
        answer:
          "Va dans 'Mon Compte' → 'Mes annonces', puis appuie sur l'annonce concernée. Un toggle 'Annonce active/inactive' te permet de la désactiver en un clic. Une annonce inactive n'apparaît plus dans les résultats de recherche et ne peut plus recevoir de nouvelles demandes. Les réservations déjà acceptées restent valables. Tu peux réactiver ton annonce à tout moment.",
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
          "Le débit a lieu en deux temps. Le prix de la location est débité immédiatement au moment où tu confirmes ton paiement après acceptation de ta demande. La caution, elle, est simplement bloquée (mise en hold) sur ta carte au même moment. Elle n'est pas débitée sauf en cas de dommage constaté. Si tout se passe bien, la caution est libérée automatiquement à la fin de la location.",
      },
      {
        id: 'pay2',
        question: 'Comment fonctionne la caution exactement ?',
        answer:
          "La caution fonctionne comme une empreinte de carte bancaire à l'hôtel. Le montant est réservé sur ta carte (il apparaît parfois comme 'en attente' dans ton application bancaire) mais n'est pas encaissé. Tu ne paies pas réellement la caution sauf en cas de dommage avéré sur l'objet. La caution est libérée automatiquement dans les 24h suivant la confirmation de bon retour de l'objet.",
      },
      {
        id: 'pay3',
        question: 'La caution est-elle vraiment prélevée ?',
        answer:
          "Non, sauf en cas de dommage. La caution est uniquement bloquée sur ta carte pendant la durée de la location. Elle ne passe jamais sur le compte du loueur ni de LoueTonBien tant que la location se déroule normalement. Si l'objet est rendu en parfait état, le blocage est levé et le montant redevient disponible sur ta carte, généralement sous 5 à 10 jours ouvrés selon ta banque.",
      },
      {
        id: 'pay4',
        question: 'Dans quel délai la caution est-elle libérée ?',
        answer:
          "La caution est libérée dans les 24h suivant la confirmation du retour de l'objet par les deux parties. La disponibilité effective des fonds sur ton compte bancaire dépend ensuite de ta banque : généralement 3 à 7 jours ouvrés pour les cartes de crédit, et jusqu'à 2 jours pour les cartes de débit. Si la caution n'est pas libérée passé ce délai, contacte notre support.",
      },
      {
        id: 'pay5',
        question: 'Comment obtenir un remboursement ?',
        answer:
          "Les remboursements sont traités automatiquement selon les cas : annulation avant acceptation → remboursement immédiat et total, annulation 48h avant la location → remboursement intégral du prix de location, annulation moins de 48h avant → remboursement à 50%, litige avéré (objet non conforme) → remboursement selon décision du support. Les remboursements apparaissent sur ton relevé bancaire sous 5 à 10 jours ouvrés.",
      },
      {
        id: 'pay6',
        question: 'Quels moyens de paiement sont acceptés ?',
        answer:
          "LoueTonBien accepte toutes les cartes bancaires (Visa, Mastercard, American Express) via Stripe. Les paiements en espèces, par virement direct ou par chèque ne sont pas autorisés sur la plateforme car ils ne permettent pas de garantir la protection des deux parties en cas de litige. Apple Pay et Google Pay sont également disponibles selon ton appareil.",
      },
      {
        id: 'pay7',
        question: 'Combien prend LoueTonBien de commission ?',
        answer:
          "LoueTonBien applique deux types de frais, clairement affichés avant tout paiement. Le propriétaire verse une commission de 8 % sur le montant de la location (déduite automatiquement de son versement). Le locataire paie des frais de service de 7 % ajoutés au prix affiché. Par exemple, pour une location à 40 €/jour : le locataire paie 42,80 € (40 € + 2,80 € de frais), et le propriétaire reçoit 36,80 € (40 € − 3,20 € de commission). Ces frais couvrent le paiement sécurisé via Stripe, la protection des transactions, le support en cas de litige et la maintenance de la plateforme.",
      },
      {
        id: 'pay8',
        question: 'Où voir mes gains en tant que loueur ?',
        answer:
          "Tes gains sont visibles dans 'Mon Compte' → 'Mon Portefeuille'. Tu y trouveras le total de tes gains ce mois, le total historique et le détail de chaque transaction. Pour un historique encore plus détaillé avec les dates de virement et les relevés fiscaux, accède à ton tableau de bord Stripe depuis 'Gérer mon compte Stripe'. Stripe conserve l'ensemble de tes données financières.",
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
          "Oui, entièrement. LoueTonBien ne stocke jamais tes données bancaires. Tous les paiements sont traités par Stripe, certifié PCI-DSS niveau 1, le niveau de sécurité le plus élevé dans l'industrie du paiement. Ni ton numéro de carte, ni ton IBAN ne transitent par les serveurs de LoueTonBien. Stripe est utilisé par des millions d'entreprises dans le monde, dont Amazon, Airbnb et Doctolib.",
      },
      {
        id: 's2',
        question: 'Comment sont vérifiés les utilisateurs ?',
        answer:
          "Chaque loueur doit passer par une vérification d'identité réalisée par Stripe avant de pouvoir recevoir des paiements. Stripe vérifie la pièce d'identité et les coordonnées bancaires. Les profils affichent également les avis laissés par les autres utilisateurs après chaque location, la date d'inscription et le nombre de transactions réalisées. Tu peux aussi voir si un utilisateur a vérifié son numéro de téléphone.",
      },
      {
        id: 's3',
        question: "Que faire si je ne reçois pas l'objet ?",
        answer:
          "Si le loueur ne se présente pas au rendez-vous ou ne remet pas l'objet, signale-le immédiatement via 'Signaler un problème' sur la page de la réservation. N'effectue aucun paiement en dehors de la plateforme. LoueTonBien déclenche un remboursement intégral du prix de location et de la caution. Le compte du loueur est suspendu pendant l'enquête et peut être définitivement banni en cas de mauvaise foi avérée.",
      },
      {
        id: 's4',
        question: 'Comment signaler un utilisateur suspect ?',
        answer:
          "Sur le profil de n'importe quel utilisateur, appuie sur les trois points '...' en haut à droite puis 'Signaler cet utilisateur'. Précise le motif (comportement inapproprié, faux profil, tentative de paiement hors plateforme, etc.) et ajoute une description. Notre équipe examine chaque signalement sous 24h. En cas d'urgence ou de situation dangereuse, contacte directement le support via support@louetonbien.fr.",
      },
      {
        id: 's5',
        question: 'Que faire en cas de litige ?',
        answer:
          "En cas de désaccord entre loueur et locataire (objet endommagé, description non conforme, remboursement contesté), contacte le support LoueTonBien via 'Contacter le support' dans le Centre d'aide. Joins les preuves disponibles : photos, messages échangés, description de la situation. Notre équipe joue le rôle d'arbitre impartial et rend une décision sous 72h ouvrées. Nous pouvons capturer ou libérer la caution selon notre analyse.",
      },
      {
        id: 's6',
        question: "LoueTonBien est-il responsable des objets loués ?",
        answer:
          "LoueTonBien est une plateforme de mise en relation et n'est pas propriétaire des objets proposés à la location. En cas de dommage, la caution constitue la première protection du loueur. Pour les objets de valeur élevée, nous recommandons au loueur de vérifier que sa propre assurance habitation couvre le prêt d'objets entre particuliers. C'est souvent le cas avec les contrats multirisques habitation. LoueTonBien intervient en arbitre en cas de litige entre les deux parties.",
      },
    ],
  },
];

export default helpData;
