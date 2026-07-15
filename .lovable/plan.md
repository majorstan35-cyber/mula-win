
# Mula — build plan

Brand: **Mula** (from mula.com). Black + gold, mobile-first, premium feel.

## Important note on fairness

You picked "Real M-Pesa, provably fair." That means the backend cannot hide a "revenue-gate" that blocks wins until KES 100M is collected — that's rigging and illegal under BCLB rules. Instead I'll build **provably fair** draws: each round commits to a hashed seed BEFORE the player pays, and reveals the seed after. Players can verify the 12 numbers weren't chosen to make them lose. The jackpot odds (e.g. 1 in N) are transparent and configurable by admin — that's the legitimate lever, not a hidden switch.

You'll also need a BCLB licence to legally operate this in Kenya. I'll build the product; licensing is on you.

## Scope

### Player flow
- Landing: huge jackpot amount, 12 target numbers, countdown to next reveal cycle, one big gold "Play KES 200" button.
- Phone login: enter Kenyan phone → OTP via SMS (Africa's Talking or Twilio) → session.
- Play: tap Play → STK Push to phone → confirm on M-Pesa → animated reveal of 12 numbers one-by-one → win/lose result → "Play Again."
- History: your past runs (numbers, result, timestamp, M-Pesa ref).
- Social proof slides: rotating "Player 07xx**45 matched 9/12 just now" (real recent runs, phone masked).

### Admin dashboard (`/admin`, role-gated)
- Users list, search, block.
- Payments list with M-Pesa references, filters, CSV export.
- Jackpot config: amount, odds (1 in N), pool of numbers, target numbers rotation.
- Pause / resume draws.
- Analytics: revenue, runs, unique players, win rate, conversion.
- Manual "release win" override (audited).
- Server-seed commit/reveal log for each round.

### Backend
- Lovable Cloud (Supabase): auth (phone+OTP), tables, RLS, edge functions.
- M-Pesa Daraja STK Push + callback webhook.
- Provably-fair draw engine: commit hash before pay, reveal seed after.
- Admin role via `user_roles` table + `has_role()` SDF.

## Technical outline

Tables: `profiles`, `user_roles`, `jackpot_config`, `rounds` (seed commit/reveal), `runs` (one per KES 200), `payments` (M-Pesa txn), `admin_audit`.

Server functions:
- `initiatePlay` → creates pending run, calls Daraja STK Push.
- `mpesaCallback` (public API route) → verifies signature, marks payment paid, generates 12 numbers from `hash(server_seed + run_id + user_id)`, checks match, updates run.
- `getRoundCommit` → returns current round's seed hash.
- Admin fns: `setJackpot`, `pauseDraws`, `listUsers`, `listPayments`, `releaseWin`.

Secrets needed from you later (I'll ask when we get there):
- `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`
- SMS provider key (Africa's Talking recommended for KE) for OTP

## Build order

1. Enable Lovable Cloud + design system (black/gold, Outfit + Inter fonts).
2. Landing page: jackpot, countdown, target numbers, Play button, social-proof slides — all mocked first so you can see the feel.
3. Phone auth (OTP).
4. DB schema + RLS + roles.
5. Provably-fair draw engine + animated reveal UI.
6. M-Pesa Daraja STK Push + callback.
7. User history page.
8. Admin dashboard (users, payments, config, pause, analytics, audit).
9. Polish + performance + SEO/meta.

This is a large build — I'll ship it in that order, verifying each step. Approve and I'll start with steps 1–2 (Cloud + landing).
