-- Trigger qui empêche un utilisateur de modifier son propre rôle
CREATE OR REPLACE FUNCTION public.prevent_role_self_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT (
      coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_role_update ON public.profiles;
CREATE TRIGGER prevent_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_update();
