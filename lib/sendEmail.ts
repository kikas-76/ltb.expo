// DEPRECATED: send-email is now internal-only and must never be called from the frontend.
// All email sending has been moved to backend edge functions:
//   - finalize-booking-payment  (booking paid emails)
//   - chat-notify               (accept/reject/deposit-released/dispute emails)
//   - admin-action              (admin account emails)
// Do not import or call this function from any frontend code.

export async function sendEmail(
  _to: string,
  _template: string,
  _data: Record<string, any>
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('sendEmail is deprecated and must not be called from the frontend.');
  }
}
