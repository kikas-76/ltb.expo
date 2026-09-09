// Complète app.json. Les Universal Links (ios.associatedDomains) exigent la
// capability « Associated Domains » sur le profil de provisionnement : les
// builds de test locaux, faits sans connexion Apple avec le profil ad hoc
// existant, échouent à la signature. On les retire uniquement quand
// LTB_SKIP_ASSOCIATED_DOMAINS=1 est passé au build ; les builds de soumission
// (eas build --profile production, interactif) gardent la capability.
module.exports = ({ config }) => {
  if (process.env.LTB_SKIP_ASSOCIATED_DOMAINS === '1') {
    const { associatedDomains, ...ios } = config.ios ?? {};
    return { ...config, ios };
  }
  return config;
};
