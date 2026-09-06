import type { TextStyle } from 'react-native';

/**
 * Échelle typographique de l'app : deux tailles de titres (page et section),
 * un corps de texte, une légende. Titres en Outfit Bold (alias Inter-Bold),
 * texte courant en Plus Jakarta Sans Regular (alias Inter-Regular).
 */
export const Type = {
  /** Titre de page : « Mes annonces », nom d'une annonce… */
  pageTitle: { fontFamily: 'Inter-Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.6 } as TextStyle,
  /** Titre de section : « Les plus populaires », « Description »… */
  sectionTitle: { fontFamily: 'Inter-Bold', fontSize: 17, lineHeight: 22, letterSpacing: -0.2 } as TextStyle,
  /** Corps de texte. */
  body: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 22 } as TextStyle,
  /** Libellé de bouton, chip, onglet. */
  label: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 18 } as TextStyle,
  /** Légende, méta, aide. */
  caption: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 16 } as TextStyle,
};
