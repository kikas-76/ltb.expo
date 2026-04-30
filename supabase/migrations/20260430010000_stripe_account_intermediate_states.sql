/*
  # Track Stripe Connect intermediate states

  The `profiles` table only stored two booleans for the Stripe account:
  `stripe_onboarding_complete` (a synthetic AND of three flags) and
  `stripe_charges_enabled` / `stripe_payouts_enabled`. That made it
  impossible to distinguish the four states a Connect account can sit
  in:

   1. Not started — `stripe_account_id IS NULL`.
   2. Onboarding incomplete — account exists, `details_submitted` false.
   3. Pending Stripe review — submitted, waiting on charges/payouts.
   4. Active — charges + payouts both true, no requirements due.
   5. Action required — Stripe re-disabled (KYC threshold, missing
      docs) → `requirements.past_due` populated or
      `requirements.disabled_reason` set.

  The wallet UI couldn't render those distinctly, and we never alerted
  the user when their account dropped from active to "action required".

  Two new columns:
   - `stripe_details_submitted boolean` — separates "form filled" from
     "Stripe approved".
   - `stripe_requirements jsonb` — compact subset of Stripe's
     requirements object (`currently_due`, `past_due`,
     `disabled_reason`, `current_deadline`). Read by the wallet, the
     webhook writes it on every `account.updated`.

  Backfill: any account currently `charges_enabled` must have
  submitted details (Stripe enables charges only after submission).
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_requirements jsonb;

UPDATE public.profiles
   SET stripe_details_submitted = true
 WHERE stripe_charges_enabled = true
   AND COALESCE(stripe_details_submitted, false) = false;
