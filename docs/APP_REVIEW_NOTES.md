# Notes pour App Review (à coller dans App Store Connect → Notes)

Compte de démonstration : `apple.review@louetonbien.fr` (mot de passe transmis séparément, ne pas le commiter).
Le compte est déjà vérifié et onboardé, situé à Paris.
Annonce de test : « AirPods 4 » à 2 € / jour, sur le compte fondateur « david » (Stripe Connect actif).

## Texte à coller (anglais, pour le reviewer)

LoueTonBien is a French peer-to-peer rental marketplace: people rent physical items (tools, cameras, sports gear…) from neighbours. The service is available in France only, so the reviewer's own location will show no listings nearby; please use the demo account, which is located in Paris.

Demo account (already verified, onboarding completed):
- Email: apple.review@louetonbien.fr
- Password: <see field "Sign-in required">

Suggested test flow:
1. Sign in with the demo account (or with Sign in with Apple / Google — both are supported and equally prominent).
2. Explore listings on the Home tab, open a listing, view the owner's public profile.
3. Search "AirPods" or open the listing "AirPods 4" (2 € per day, owner: david, the founder's account). Pick dates and send a rental request. The owner accepts within minutes during business hours (Paris time), which unlocks payment from the conversation.
4. Payment uses Stripe in live mode: a real card is charged 2 € per day plus a 7 % service fee, and refunded by us right after the review. If you prefer not to pay, the full flow is shown in the attached video.
5. Chat with the owner from the Messages tab. From the "…" menu you can report the conversation, report the user, or block the user (blocked users can no longer message or book each other).
6. Account deletion is available in Profile → Account settings → Delete my account.

An account is required to use the app because every feature is person-to-person (renting, paying, messaging, reviews) and payments go through Stripe Connect between identified users. Entering a postal address during onboarding is optional and can be skipped.

Payments only concern the rental of physical goods between users (Stripe Connect); no digital content or feature is sold in the app.
Report content, block users and moderation: reports are reviewed by our team within 24 hours (admin@louetonbien.fr).
