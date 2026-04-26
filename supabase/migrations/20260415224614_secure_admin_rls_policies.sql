-- Migrer les RLS policies admin vulnérables (profiles.role check)
-- vers le JWT app_metadata sécurisé

-- disputes SELECT : remplacer la policy vulnérable
DROP POLICY IF EXISTS "Admin full read disputes" ON public.disputes;
CREATE POLICY "Admin full read disputes" ON public.disputes
  FOR SELECT TO authenticated
  USING (
    (((SELECT auth.jwt()->'app_metadata'->>'role')) = 'admin')
    OR ((SELECT auth.uid()) = reporter_id)
    OR EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = disputes.booking_id
      AND bookings.renter_id = (SELECT auth.uid())
    )
  );

-- disputes UPDATE
DROP POLICY IF EXISTS "Admin update disputes" ON public.disputes;
CREATE POLICY "Admin update disputes" ON public.disputes
  FOR UPDATE TO authenticated
  USING (
    ((SELECT auth.jwt()->'app_metadata'->>'role') = 'admin')
  );

-- reports SELECT
DROP POLICY IF EXISTS "Admin full read reports" ON public.reports;
CREATE POLICY "Admin full read reports" ON public.reports
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()->'app_metadata'->>'role') = 'admin')
    OR ((SELECT auth.uid()) = reporter_id)
  );

-- reports UPDATE
DROP POLICY IF EXISTS "Admin update reports" ON public.reports;
CREATE POLICY "Admin update reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (
    ((SELECT auth.jwt()->'app_metadata'->>'role') = 'admin')
  );
