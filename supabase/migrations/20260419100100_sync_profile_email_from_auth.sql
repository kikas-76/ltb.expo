/*
  # Keep profiles.email in sync with auth.users.email

  account-settings.tsx no longer writes profiles.email when the user
  requests an email change, because at that point auth.users.email is
  still the OLD address (Supabase only flips it once the user clicks
  the confirmation link sent to the new address). Writing eagerly
  desynced the two and let a hijacked session display a wrong email
  without owning the inbox.

  This trigger mirrors any change of auth.users.email back into
  public.profiles, so the DB row catches up exactly when the auth
  side does — i.e. on confirmation.
*/

CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
       SET email = NEW.email,
           updated_at = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_email_from_auth ON auth.users;

CREATE TRIGGER sync_profile_email_from_auth
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_email_from_auth();
