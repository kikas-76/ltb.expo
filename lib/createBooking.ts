import { supabase } from '@/lib/supabase';

export { getDiscount, computeRentalTotal } from '@/lib/pricing';

export interface CreatePendingBookingInput {
  listingId: string;
  renterId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  conversationId: string;
}

export interface CreatedBooking {
  id: string;
  total_price: number | null;
  status: string | null;
}

export async function createPendingPaymentBooking(
  input: CreatePendingBookingInput
): Promise<{ data: CreatedBooking | null; error: any }> {
  const { data: listingData } = await supabase
    .from('listings')
    .select('deposit_amount')
    .eq('id', input.listingId)
    .maybeSingle();

  return await supabase
    .from('bookings')
    .insert({
      listing_id: input.listingId,
      renter_id: input.renterId,
      owner_id: input.ownerId,
      status: 'pending_payment',
      start_date: new Date(input.startDate + 'T00:00:00').toISOString(),
      end_date: new Date(input.endDate + 'T23:59:59').toISOString(),
      total_price: input.totalPrice,
      deposit_amount: listingData?.deposit_amount ?? 0,
      conversation_id: input.conversationId,
    })
    .select('id, total_price, status')
    .single();
}
