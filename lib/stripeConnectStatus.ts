// Five derived states a Stripe Connect account can sit in. Same logic
// is consumed by the renter wallet (their own account) and by the
// admin user detail/list (someone else's account).
//
//   not_started     — no Stripe account yet
//   onboarding      — account exists but onboarding form not submitted
//   pending_review  — submitted, Stripe still validating
//   active          — charges + payouts enabled, no requirements due
//   action_required — Stripe needs more info (KYC threshold, past_due,
//                     or disabled_reason set). Pre-emptive alert: user
//                     can still receive payments while requirements are
//                     `currently_due`, but loses the ability when they
//                     slip into `past_due` or Stripe sets disabled_reason.
export type ConnectStatus =
  | 'not_started'
  | 'onboarding'
  | 'pending_review'
  | 'active'
  | 'action_required';

export interface ConnectStateInput {
  account_id?: string | null;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements: {
    past_due?: string[] | null;
    currently_due?: string[] | null;
    disabled_reason?: string | null;
    current_deadline?: number | null;
  } | null;
}

export function deriveConnectStatus(s: ConnectStateInput): ConnectStatus {
  if (!s.account_id) return 'not_started';
  if (!s.details_submitted) return 'onboarding';
  const reqs = s.requirements ?? {};
  if (reqs.disabled_reason || (reqs.past_due?.length ?? 0) > 0) {
    return 'action_required';
  }
  if (!s.charges_enabled || !s.payouts_enabled) return 'pending_review';
  return 'active';
}

// Short human label for badges / chips.
export function connectStatusLabel(s: ConnectStatus): string {
  switch (s) {
    case 'not_started':     return 'Pas démarré';
    case 'onboarding':      return 'Onboarding';
    case 'pending_review':  return 'En vérification';
    case 'active':          return 'Actif';
    case 'action_required': return 'Action requise';
  }
}

// Tailwind-ish swatch for each status — picked once here so the wallet
// and admin views stay visually consistent.
export function connectStatusColors(s: ConnectStatus): { bg: string; fg: string } {
  switch (s) {
    case 'active':          return { bg: '#DCFCE7', fg: '#166534' };
    case 'pending_review':  return { bg: '#DBEAFE', fg: '#1E40AF' };
    case 'action_required': return { bg: '#FEE2E2', fg: '#991B1B' };
    case 'onboarding':      return { bg: '#FEF3C7', fg: '#92400E' };
    case 'not_started':     return { bg: '#F3F4F6', fg: '#6B7280' };
  }
}
