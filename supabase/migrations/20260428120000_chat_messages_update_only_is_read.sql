/*
  # Restrict chat_messages UPDATE to is_read only

  Background
  ----------
  Migration 20260415224629 added a broad RLS policy "Participants can
  update chat messages" allowing any participant to UPDATE any column on
  any message in their conversation. The migration comment says the
  intent was to support marking messages as read (`is_read`), but the
  policy itself doesn't enforce that — a participant could rewrite the
  content of an old message, change `is_system`, change `sender_id`,
  etc. That breaks message integrity / non-repudiation.

  Audit cross-check (audit_2026-04-28): every client call site to
  `.from('chat_messages').update(...)` only ever passes `{ is_read: true }`
  — confirmed in app/chat/[id].tsx and app/(tabs)/reservations.tsx.

  Fix
  ---
  Use column-level GRANTs to restrict UPDATE to the `is_read` column
  only. The existing RLS policy still gates which *rows* the caller can
  touch (must be a participant in the conversation), and the column
  GRANT now gates which *columns* may change.

  Service role bypasses RLS and column GRANTs, so Edge Functions
  (post-system-message etc.) keep full write access.
*/

-- Strip the broad UPDATE privilege at the column level
REVOKE UPDATE ON public.chat_messages FROM authenticated, anon;

-- Re-grant UPDATE on `is_read` only. anon never needed UPDATE.
GRANT UPDATE (is_read) ON public.chat_messages TO authenticated;
