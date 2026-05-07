/*
  # Ajouter bookings à la publication realtime

  Bug observé : après un scan de QR (handover ou return), l'autre partie
  devait quitter le chat et revenir pour voir l'UI passer à in_progress
  / pending_owner_validation. La transition d'état se faisait bien
  serveur-side (la RPC redeem_handover_token applique l'UPDATE atomic),
  mais les clients abonnés ne recevaient rien.

  Cause : la table public.bookings n'était pas membre de la publication
  supabase_realtime — Postgres ne streamait donc pas ses INSERT/UPDATE
  /DELETE vers le service realtime, et les subscriptions
  postgres_changes côté client (chat/[id].tsx ligne ~344 et
  HandoverQRDisplay.tsx) étaient des no-ops silencieux.

  Effet immédiat après cette migration :
  - Le QR display side voit le `done` passer à true dès que le scanner
    redeem → l'animation "Location démarrée" / "Retour confirmé" joue,
    puis le bottom sheet se ferme tout seul après 2,4 s.
  - Le chat de chaque partie voit bookingStatus changer en direct → la
    card "Remise" disparaît et la card "Retour" apparaît sans refresh.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
