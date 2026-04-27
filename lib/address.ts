// Pulls the city name out of a Google-style "street, 75001 Paris, France"
// address string. Used in card subtitles and reservation rows. Pure
// string manipulation — testable in isolation.

export function extractCityFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',');
  if (parts.length < 2) return null;
  const cityPart = parts[parts.length - 2].trim();
  // The city segment usually arrives as "75001 Paris" — strip the postal
  // prefix when present.
  const match = cityPart.match(/^\d{4,6}\s+(.+)$/);
  if (match) return match[1].trim();
  return cityPart || null;
}
