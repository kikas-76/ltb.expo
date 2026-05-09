/*
  # Fix : annonce introuvable après l'ajout de stock_count + packs

  La table public.listings utilise des GRANTs au niveau colonne (durcissement
  RGPD). Quand 20260509100000 a ajouté stock_count + packs, ces nouvelles
  colonnes n'ont pas hérité du SELECT pour authenticated/anon → toute requête
  les sélectionnant échouait avec "permission denied" et le client voyait
  "annonce introuvable".

  Fix : GRANT SELECT explicite sur les 2 colonnes pour authenticated + anon
  (la fiche annonce est consultable même non-loggué). bookings/conversations
  ont déjà des GRANTs au niveau table donc quantity est lisible sans action
  supplémentaire — les blocs DO sont défensifs au cas où ce ne soit pas le
  cas sur un autre environnement.
*/

GRANT SELECT (stock_count, packs) ON public.listings TO authenticated;
GRANT SELECT (stock_count, packs) ON public.listings TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema='public' AND table_name='bookings'
      AND grantee='authenticated' AND privilege_type='SELECT'
  ) THEN
    EXECUTE 'GRANT SELECT (quantity) ON public.bookings TO authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema='public' AND table_name='conversations'
      AND grantee='authenticated' AND privilege_type='SELECT'
  ) THEN
    EXECUTE 'GRANT SELECT (quantity) ON public.conversations TO authenticated';
  END IF;
END $$;
