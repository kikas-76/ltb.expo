import { supabase } from './supabase';

export async function updateBookingStatus(
  bookingId: string,
  newStatus: string,
  extra?: Record<string, boolean | string | null>
): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: newStatus,
    p_extra: extra ?? {},
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return {};
}

export async function updateBookingConfirmationFields(
  bookingId: string,
  currentStatus: string,
  fields: Record<string, boolean | string | null>
): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('update_booking_status', {
    p_booking_id: bookingId,
    p_new_status: currentStatus,
    p_extra: fields,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return {};
}
