/** Hauteur mini d'un cadre photo, en fraction de sa largeur (4:3). */
export const FRAME_MIN = 0.75;
/** Hauteur maxi d'un cadre photo, en fraction de sa largeur (4:5). */
export const FRAME_MAX = 1.25;

/**
 * Hauteur d'un cadre pleine largeur qui épouse le ratio d'une photo, bornée
 * pour qu'une photo verticale reste lisible sans envahir l'écran.
 */
export function frameHeightFor(width: number, imageRatio: number): number {
  const ratio = imageRatio > 0 ? imageRatio : 4 / 3;
  return Math.round(Math.min(width * FRAME_MAX, Math.max(width * FRAME_MIN, width / ratio)));
}

/**
 * `cover` quand le ratio de la photo est proche de celui du cadre (le recadrage
 * reste marginal), `contain` sinon : l'objet est alors visible en entier, le
 * cadre étant rempli par un fond flouté de la même photo.
 */
export function contentFitFor(
  imageRatio: number,
  boxRatio: number,
  tolerance = 0.2,
): 'cover' | 'contain' {
  if (!(imageRatio > 0) || !(boxRatio > 0)) return 'cover';
  return Math.abs(Math.log(imageRatio / boxRatio)) <= Math.log(1 + tolerance) ? 'cover' : 'contain';
}
