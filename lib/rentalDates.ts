// Jours de location affichés à l'utilisateur.
//
// Une réservation va de start_date 00:00:00 UTC à end_date 23:59:59 UTC
// (create_booking_for_payment) et une conversation garde des dates seules
// (« 2026-12-21 », lues comme minuit UTC). Les formater à l'heure du téléphone
// décale la date de fin d'un jour en France : 23:59:59 UTC, c'est déjà 00:59
// le lendemain à Paris. On affiche donc toujours le jour calendaire UTC.
//
// Ne pas utiliser pour une date choisie dans le calendrier de l'app (objet Date
// local) ni pour un horodatage (created_at…), qui s'affichent à l'heure locale.

const LONG: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** Jour de location (texte ISO ou date seule) en date locale, à midi. */
export function rentalDay(value: string): Date {
  const d = new Date(value);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
}

/** « 21 décembre 2026 » par défaut, ou le format demandé. Vide si la date est invalide. */
export function formatRentalDate(value: string, options: Intl.DateTimeFormatOptions = LONG): string {
  const day = rentalDay(value);
  if (Number.isNaN(day.getTime())) return '';
  return day.toLocaleDateString('fr-FR', options);
}
