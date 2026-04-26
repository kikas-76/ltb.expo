import { supabase } from '@/lib/supabase';

export { getDiscount, computeRentalTotal } from '@/lib/pricing';

export interface CreatePendingBookingInput {
  listingId: string;
  startDate: string;
  endDate: string;
  conversationId: string;
}

export interface CreatedBooking {
  id: string;
  total_price: number | null;
  status: string | null;
}

// Calls the create_booking_for_payment RPC, which recomputes price, deposit
// and owner_id server-side from the listings table. Direct INSERTs into
// public.bookings from the client are blocked by REVOKE — see migration
// 20260426_revoke_direct_booking_insert.sql.
export async function createPendingPaymentBooking(
  input: CreatePendingBookingInput
): Promise<{ data: CreatedBooking | null; error: any }> {
  const { data, error } = await supabase.rpc('create_booking_for_payment', {
    p_listing_id: input.listingId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_conversation_id: input.conversationId,
  });

  if (error) return { data: null, error };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: null, error: new Error('No booking returned') };

  return {
    data: {
      id: row.booking_id,
      total_price: row.total_price ?? null,
      status: row.status ?? null,
    },
    error: null,
  };
}
