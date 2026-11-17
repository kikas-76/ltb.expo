# Notes pour App Review (à coller dans App Store Connect → Notes)

Compte de démonstration : `apple.review@louetonbien.fr` (mot de passe transmis séparément, ne pas le commiter).
Le compte est déjà vérifié et onboardé, situé à Paris.
Annonce de test : « Airpods » à 2 € / jour, sur le compte fondateur « david » (Stripe Connect actif).
Le compte démo a une demande déjà acceptée sur « Airpods » (du 14 au 15 décembre 2026, conversation
`1d06ebb4-113c-4374-a9fe-10701be5096f`) : le bouton « Payer » mène directement à Apple Pay. Sa
réservation n'expire pas (exemption dans `expire-stale-pending-payments`). Si l'examen glisse après le
14 décembre, décaler `conversations.start_date / end_date` de cette conversation.

Historique : build 4 refusé le 17/11/2026 (5.1.1(v) compte obligatoire ; 2.1 Apple Pay introuvable).
Le build 5 ouvre l'app sans compte et affiche « Configurer Apple Pay » quand Wallet est vide.

## Texte à coller (anglais, pour le reviewer)

LoueTonBien is a French peer-to-peer rental marketplace: people rent physical items (tools, cameras, sports gear…) from neighbours. The service is available in France only, so the reviewer's own location will show no listings nearby; the demo account is located in Paris.

No account is needed to use the app's browsing features. The app opens directly on the listings ("Rechercher" tab): search, categories, listing details, owner profiles, the help center and the legal pages are all available without signing in. An account is only required for account-based features: sending a rental request and paying, messaging other users, favorites, publishing a listing and account settings. When signed out, the 4th tab is labelled "Se connecter" (Sign in), and the "Louer" and "Messages" tabs explain why an account is needed.

Demo account (already verified, onboarding completed):
- Email: apple.review@louetonbien.fr
- Password: <see field "Sign-in required">

Where to find Apple Pay:
1. Sign in with the demo account (tab "Se connecter", or Sign in with Apple / Google).
2. Open the "Messages" tab, then the conversation "Airpods". The owner has already accepted this rental request.
3. Tap the green "Payer" button. The payment screen ("Paiement sécurisé") shows the Apple Pay button at the top of the "Moyen de paiement" section, above the card form.
4. If the device has no card in Wallet, the button "Set up Apple Pay" is shown instead and opens Wallet; once a card is added, the Apple Pay button appears.
You can also reach the same conversation from the listing: search "Airpods", open it, then tap "Voir ma demande".

Payment uses Stripe in live mode: 2 € plus a 7 % service fee (2.14 €) are charged and refunded by us right after the review. You can stop at the Apple Pay sheet without paying.

Other features:
- Chat with the owner from the Messages tab. From the "…" menu you can report the conversation, report the user, or block the user (blocked users can no longer message or book each other).
- The account also contains a completed rental with its conversation, a listing of its own ("Louer" tab, "Inactives" filter; it is inactive so that real users cannot book it) and a favorite.
- Account deletion is available in the app, under these French labels: Mon Compte → Paramètres du compte → Supprimer mon compte.

Payments only concern the rental of physical goods between users (Stripe Connect); no digital content or feature is sold in the app.
Report content, block users and moderation: reports are reviewed by our team within 24 hours (admin@louetonbien.fr).

## Réponse au message d'App Review (Resolution Center, anglais)

Hello,

Thank you for your review. We have submitted build 1.0 (5), which addresses both points:

Guideline 5.1.1(v): the app no longer requires an account to be used. It now opens directly on the listings, and users can search, browse categories, view listing details, owner profiles, the help center and the legal pages without signing in. Registration is only requested for account-based features: renting an item (request and payment), messaging other users, favorites, publishing a listing and account settings.

Guideline 2.1: the app does integrate Apple Pay, on the payment screen of a rental. To reach it: sign in with the demo account, open the "Messages" tab, open the "Airpods" conversation (the request is already accepted by the owner) and tap "Payer". The Apple Pay button is at the top of the "Moyen de paiement" section. In build 4 the button was only displayed when a card was present in Wallet, which is probably why it was not visible on the review device; build 5 shows the "Set up Apple Pay" button in that case. The steps are also in the Review Notes.

Best regards,
LoueTonBien
