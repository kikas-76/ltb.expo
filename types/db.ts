// Domain types reflecting the Supabase schema. These are hand-written because
// types are not generated via `supabase gen types typescript`. Keep aligned
// with migrations under `supabase/migrations/` and the column-naming notes in
// `CLAUDE.md` (Listings: `name`/`price`/`is_active`; Bookings: `handover_*`,
// `return_*`).

export interface LocationData {
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  photo_url: string | null;
  phone_number: string | null;
  location_data: LocationData | null;
  is_pro: boolean;
  bio: string | null;
  role: string | null;
  onboarding_completed: boolean;
  created_at?: string;
}

export interface PublicProfile {
  id: string;
  username: string | null;
  avatar_url?: string | null;
  photo_url: string | null;
  bio?: string | null;
  is_pro: boolean;
  business_name?: string | null;
  business_type?: string | null;
  business_hours?: unknown | null;
  business_address?: string | null;
  siren_number?: string | null;
  location_data?: LocationData | null;
  created_at?: string;
}

export interface ListingRow {
  id: string;
  name: string;
  price: number;
  photos_url: string[] | null;
  category_name: string | null;
  category_id: string | null;
  latitude: number | null;
  longitude: number | null;
  location_data?: LocationData | null;
  owner_type?: string | null;
  is_active?: boolean;
  views_count?: number;
  saves_count?: number;
  created_at?: string;
  // Owner relation: when selected, Supabase may return either a row or an
  // array depending on the FK definition. Callers should normalize before use.
  owner?: ListingOwner | ListingOwner[] | null;
  profiles?: ListingOwner | ListingOwner[] | null;
}

export interface ListingOwner {
  id?: string;
  username: string | null;
  photo_url: string | null;
  is_pro?: boolean;
  location_data?: LocationData | null;
}

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'refused'
  | 'pending_payment'
  | 'active'
  | 'in_progress'
  | 'pending_return'
  | 'pending_owner_validation'
  | 'completed'
  | 'disputed'
  | 'cancelled'
  | 'expired';

export interface BookingRow {
  id: string;
  listing_id: string;
  owner_id: string;
  renter_id: string;
  status: BookingStatus;
  total_price: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  return_confirmed_at?: string | null;
  stripe_rental_payment_intent_id?: string | null;
  // Joined name from listings via `select('listings(name)')`
  listings?: { name: string | null } | { name: string | null }[] | null;
}
