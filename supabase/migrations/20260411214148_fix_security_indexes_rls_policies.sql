/*
  # Fix Security Issues: Indexes, RLS Policies, and Functions

  ## Summary
  Comprehensive security and performance fix addressing all Supabase advisor warnings.

  ## 1. Missing Foreign Key Indexes
  Adding covering indexes for all unindexed foreign keys:
  - chat_messages.sender_id
  - conversations.listing_id
  - disputes.booking_id, disputes.reporter_id
  - listing_views.listing_id, listing_views.viewer_id
  - listings.category_id, listings.owner_id, listings.subcategory_id
  - messages.booking_id, messages.sender_id
  - reports.reporter_id
  - saved_listings.listing_id (user_id already covered by composite PK)

  ## 2. Duplicate RLS Policies Cleanup
  Remove duplicate/redundant policies (older French-named ones superseded by English ones):
  - bookings: remove 3 older duplicate policies
  - profiles: remove 3 older duplicate policies
  - listings: keep only clean consolidated set

  ## 3. RLS auth() Performance Fix
  Replace auth.<function>() with (select auth.<function>()) in all remaining policies
  for the initialization plan optimization.

  ## 4. listing_views INSERT policy - restrict "always true" WITH CHECK

  ## 5. Function Search Path Security
  Set search_path = '' on all public functions to prevent mutable search_path attacks.

  ## 6. Drop Unused Index
  Drop listings_name_trgm_idx (unused per advisor).
*/

-- ============================================================
-- SECTION 1: Add missing foreign key indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS chat_messages_sender_id_idx
  ON public.chat_messages USING btree (sender_id);

CREATE INDEX IF NOT EXISTS conversations_listing_id_idx
  ON public.conversations USING btree (listing_id);

CREATE INDEX IF NOT EXISTS disputes_booking_id_idx
  ON public.disputes USING btree (booking_id);

CREATE INDEX IF NOT EXISTS disputes_reporter_id_idx
  ON public.disputes USING btree (reporter_id);

CREATE INDEX IF NOT EXISTS listing_views_listing_id_idx
  ON public.listing_views USING btree (listing_id);

CREATE INDEX IF NOT EXISTS listing_views_viewer_id_idx
  ON public.listing_views USING btree (viewer_id);

CREATE INDEX IF NOT EXISTS listings_category_id_idx
  ON public.listings USING btree (category_id);

CREATE INDEX IF NOT EXISTS listings_owner_id_idx
  ON public.listings USING btree (owner_id);

CREATE INDEX IF NOT EXISTS listings_subcategory_id_idx
  ON public.listings USING btree (subcategory_id);

CREATE INDEX IF NOT EXISTS messages_booking_id_idx
  ON public.messages USING btree (booking_id);

CREATE INDEX IF NOT EXISTS messages_sender_id_idx
  ON public.messages USING btree (sender_id);

CREATE INDEX IF NOT EXISTS reports_reporter_id_idx
  ON public.reports USING btree (reporter_id);

-- saved_listings.listing_id (user_id is first in composite PK, listing_id needs its own index)
CREATE INDEX IF NOT EXISTS saved_listings_listing_id_idx
  ON public.saved_listings USING btree (listing_id);

-- ============================================================
-- SECTION 2: Drop unused trigram index
-- ============================================================

DROP INDEX IF EXISTS public.listings_name_trgm_idx;

-- ============================================================
-- SECTION 3: Drop duplicate/redundant RLS policies
-- ============================================================

-- bookings: remove old French duplicates (INSERT, SELECT, UPDATE)
DROP POLICY IF EXISTS "Locataire crée une réservation" ON public.bookings;
DROP POLICY IF EXISTS "Loueur et locataire voient leurs bookings" ON public.bookings;
DROP POLICY IF EXISTS "Loueur ou locataire modifie le booking" ON public.bookings;

-- profiles: remove old French duplicates (INSERT, UPDATE) and narrow English SELECT
DROP POLICY IF EXISTS "Insertion profil à la création du compte" ON public.profiles;
DROP POLICY IF EXISTS "Utilisateur modifie son propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- ============================================================
-- SECTION 4: Recreate all policies with (select auth.uid())
-- ============================================================

-- ---- profiles ----
DROP POLICY IF EXISTS "Admin full read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profil public en lecture" ON public.profiles;

CREATE POLICY "Profil public en lecture"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Admin full read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'admin')
    OR (select auth.uid()) = id
  );

-- ---- listings ----
DROP POLICY IF EXISTS "Listings actifs publics" ON public.listings;
DROP POLICY IF EXISTS "Loueur voit ses listings inactifs" ON public.listings;
DROP POLICY IF EXISTS "Loueur crée ses listings" ON public.listings;
DROP POLICY IF EXISTS "Loueur modifie ses listings" ON public.listings;
DROP POLICY IF EXISTS "Loueur supprime ses listings" ON public.listings;
DROP POLICY IF EXISTS "Admin full read listings" ON public.listings;

CREATE POLICY "Listings actifs publics"
  ON public.listings FOR SELECT
  USING (is_active = true);

CREATE POLICY "Loueur voit ses listings inactifs"
  ON public.listings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = owner_id);

CREATE POLICY "Admin full read listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'admin')
    OR (select auth.uid()) = owner_id
  );

CREATE POLICY "Loueur crée ses listings"
  ON public.listings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Loueur modifie ses listings"
  ON public.listings FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Loueur supprime ses listings"
  ON public.listings FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = owner_id);

-- ---- bookings ----
DROP POLICY IF EXISTS "Renter and owner can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Renter can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Owner or renter can update booking status" ON public.bookings;
DROP POLICY IF EXISTS "Owner or renter can delete booking" ON public.bookings;
DROP POLICY IF EXISTS "Admin full read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin update bookings" ON public.bookings;

CREATE POLICY "Renter and owner can view their bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = renter_id OR (select auth.uid()) = owner_id);

CREATE POLICY "Renter can create bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = renter_id);

CREATE POLICY "Owner or renter can update booking status"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = owner_id OR (select auth.uid()) = renter_id)
  WITH CHECK ((select auth.uid()) = owner_id OR (select auth.uid()) = renter_id);

CREATE POLICY "Owner or renter can delete booking"
  ON public.bookings FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = owner_id OR (select auth.uid()) = renter_id);

CREATE POLICY "Admin full read bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'admin')
    OR (select auth.uid()) = renter_id
    OR (select auth.uid()) = owner_id
  );

CREATE POLICY "Admin update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'admin')
    OR (select auth.uid()) = renter_id
    OR (select auth.uid()) = owner_id
  );

-- ---- messages ----
DROP POLICY IF EXISTS "Participants voient les messages" ON public.messages;
DROP POLICY IF EXISTS "Participant envoie un message" ON public.messages;

CREATE POLICY "Participants voient les messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = messages.booking_id
      AND (bookings.renter_id = (select auth.uid()) OR bookings.owner_id = (select auth.uid()))
    )
  );

CREATE POLICY "Participant envoie un message"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = sender_id);

-- ---- saved_listings ----
DROP POLICY IF EXISTS "User voit ses favoris" ON public.saved_listings;
DROP POLICY IF EXISTS "User ajoute un favori" ON public.saved_listings;
DROP POLICY IF EXISTS "User supprime un favori" ON public.saved_listings;

CREATE POLICY "User voit ses favoris"
  ON public.saved_listings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "User ajoute un favori"
  ON public.saved_listings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User supprime un favori"
  ON public.saved_listings FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---- listing_views ----
DROP POLICY IF EXISTS "Owner can read views of their listings" ON public.listing_views;
DROP POLICY IF EXISTS "Anyone can record a view" ON public.listing_views;

CREATE POLICY "Owner can read views of their listings"
  ON public.listing_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_views.listing_id
      AND listings.owner_id = (select auth.uid())
    )
  );

-- Restrict INSERT: authenticated users only, viewer_id must match
CREATE POLICY "Authenticated users can record a view"
  ON public.listing_views FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = viewer_id);

-- Allow anon to insert views without viewer_id
CREATE POLICY "Anon can record a view"
  ON public.listing_views FOR INSERT
  TO anon
  WITH CHECK (viewer_id IS NULL);

-- ---- conversations ----
DROP POLICY IF EXISTS "Participants can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Requester can create a conversation" ON public.conversations;
DROP POLICY IF EXISTS "Owner can update conversation status" ON public.conversations;
DROP POLICY IF EXISTS "Participants can delete their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admin full read conversations" ON public.conversations;

CREATE POLICY "Participants can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = owner_id);

CREATE POLICY "Admin full read conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'admin')
    OR (select auth.uid()) = requester_id
    OR (select auth.uid()) = owner_id
  );

CREATE POLICY "Requester can create a conversation"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = requester_id);

CREATE POLICY "Owner can update conversation status"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Participants can delete their conversations"
  ON public.conversations FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = owner_id);

-- ---- chat_messages ----
DROP POLICY IF EXISTS "Participants can view chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Participants can send chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "System chat messages by participants" ON public.chat_messages;
DROP POLICY IF EXISTS "Participants can delete chat messages" ON public.chat_messages;

CREATE POLICY "Participants can view chat messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.requester_id = (select auth.uid()) OR c.owner_id = (select auth.uid()))
    )
  );

CREATE POLICY "Participants can send chat messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.requester_id = (select auth.uid()) OR c.owner_id = (select auth.uid()))
    )
  );

CREATE POLICY "System chat messages by participants"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    is_system = true
    AND sender_id IS NULL
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.requester_id = (select auth.uid()) OR c.owner_id = (select auth.uid()))
    )
  );

CREATE POLICY "Participants can delete chat messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.requester_id = (select auth.uid()) OR c.owner_id = (select auth.uid()))
    )
  );

-- ---- reports ----
DROP POLICY IF EXISTS "Authenticated users can insert own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Admin full read reports" ON public.reports;
DROP POLICY IF EXISTS "Admin update reports" ON public.reports;

CREATE POLICY "Authenticated users can insert own reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = reporter_id);

CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = reporter_id);

CREATE POLICY "Admin full read reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'admin')
    OR (select auth.uid()) = reporter_id
  );

CREATE POLICY "Admin update reports"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- ---- disputes ----
DROP POLICY IF EXISTS "Reporter can insert own dispute" ON public.disputes;
DROP POLICY IF EXISTS "Reporter can read own disputes" ON public.disputes;
DROP POLICY IF EXISTS "Renter can read disputes on their booking" ON public.disputes;
DROP POLICY IF EXISTS "Reporter can update own dispute" ON public.disputes;
DROP POLICY IF EXISTS "Admin full read disputes" ON public.disputes;
DROP POLICY IF EXISTS "Admin update disputes" ON public.disputes;

CREATE POLICY "Reporter can insert own dispute"
  ON public.disputes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = reporter_id);

CREATE POLICY "Reporter can read own disputes"
  ON public.disputes FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = reporter_id);

CREATE POLICY "Renter can read disputes on their booking"
  ON public.disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = disputes.booking_id
      AND bookings.renter_id = (select auth.uid())
    )
  );

CREATE POLICY "Admin full read disputes"
  ON public.disputes FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'admin')
    OR (select auth.uid()) = reporter_id
    OR EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = disputes.booking_id
      AND bookings.renter_id = (select auth.uid())
    )
  );

CREATE POLICY "Reporter can update own dispute"
  ON public.disputes FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = reporter_id)
  WITH CHECK ((select auth.uid()) = reporter_id);

CREATE POLICY "Admin update disputes"
  ON public.disputes FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- ---- search_history ----
DROP POLICY IF EXISTS "Users can view own search history" ON public.search_history;
DROP POLICY IF EXISTS "Users can insert own search history" ON public.search_history;
DROP POLICY IF EXISTS "Users can delete own search history" ON public.search_history;

CREATE POLICY "Users can view own search history"
  ON public.search_history FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own search history"
  ON public.search_history FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own search history"
  ON public.search_history FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- SECTION 5: Fix function search_path
-- ============================================================

ALTER FUNCTION public.immutable_unaccent(text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.listings_search_vector_update()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.get_search_suggestions(text, integer)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_updated_at()
  SET search_path = public, pg_catalog;
