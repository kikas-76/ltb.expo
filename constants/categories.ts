/**
 * Identité visuelle des catégories : une teinte de fond douce et une encre
 * foncée par catégorie, dans la palette terreuse de la marque (sauge, menthe,
 * pêche, sable, lilas…). Utilisée par la bande de l'accueil, le formulaire
 * d'annonce, les filtres et le pictogramme (CategoryIcon).
 */
export interface CategoryTheme {
  tint: string;
  ink: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  bricolage: { tint: '#E4EBD3', ink: '#3E5A2B' },
  mobilite: { tint: '#D9EBE4', ink: '#2E6B57' },
  sport: { tint: '#FCE4CF', ink: '#A8562A' },
  camping: { tint: '#DDEBD0', ink: '#4A6E2F' },
  evenementiel: { tint: '#F6DDE8', ink: '#A3446E' },
  cuisine: { tint: '#FBEBCB', ink: '#A66A1F' },
  maison: { tint: '#EEE6CF', ink: '#8C6A2A' },
  hightech: { tint: '#DCE0F2', ink: '#3F4C9C' },
  electronique: { tint: '#D8E6F2', ink: '#2F5C86' },
  musique: { tint: '#F4DEE4', ink: '#9B3B57' },
  enfants: { tint: '#E8DDF3', ink: '#6C4A9E' },
  vetements: { tint: '#F5D9D1', ink: '#A44A3A' },
  pro: { tint: '#E6E1D6', ink: '#6E5A45' },
  autre: { tint: '#E8E5DA', ink: '#6B6B5E' },
};

const DEFAULT_THEME: CategoryTheme = CATEGORY_THEMES.autre;

export function categoryTheme(value: string | null | undefined): CategoryTheme {
  return (value && CATEGORY_THEMES[value]) || DEFAULT_THEME;
}
