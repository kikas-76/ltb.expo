-- The owner accepts booking requests via the chat flow, which inserts a
-- bookings row server-side. The previous policy only allowed renters to
-- INSERT, so owner-side acceptance was blocked with 42501.
--
-- New policy: renter can always insert their own booking; owner can insert
-- a booking ONLY when a conversation already exists where they are the
-- owner and the renter matches conversation.requester_id. This prevents
-- an owner from forging a booking for an unrelated renter.

DROP POLICY IF EXISTS "Renter can create bookings" ON public.bookings;

CREATE POLICY "Renter or owner via conversation can create bookings"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = renter_id
    OR (
      (SELECT auth.uid()) = owner_id
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = bookings.conversation_id
          AND c.owner_id = (SELECT auth.uid())
          AND c.requester_id = bookings.renter_id
      )
    )
  );
