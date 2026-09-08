# Security

This app is a personal invoice tracker. It is not a bank, a tax-filing system, or a card processor.

## Reporting

If you discover a vulnerability in this project, email the repository owner privately. Do not open a public issue that includes secrets, tokens, or personal invoice data.

Supported version: the current `main` branch of this repository.

## Trust boundaries

- **Browser:** receives only the publishable Supabase key and, if online payments are enabled, the Stripe publishable key. It never receives Stripe secrets, Resend keys, VAPID private keys, or the Supabase service role key. Sensitive server modules are marked `server-only`.
- **Logged-in owner:** can read and write their own clients, invoices, and payments through Supabase Row Level Security. Composite foreign keys bind invoices to same-owner clients and payments to same-owner invoices.
- **Public invoice page:** `/invoice/[publicToken]` is an unauthenticated bearer URL. It loads a single invoice through a `security definer` RPC keyed by `public_token`. Responses are `no-store` / `no-referrer` / `noindex`. Analytics and Speed Insights are not mounted on this route. Owners can rotate the public token. `get_invoice_checkout_state` is service-role only.
- **Stripe:** card details stay on Stripe Checkout. Opening checkout or returning to a success URL does not mark an invoice paid. The Stripe webhook verifies signatures, records Stripe `event.id` uniquely, and inserts payments inside a locking RPC. Notification side effects run after durable recording.
- **Email:** Resend sends invoice PDFs and optional owner payment notices. Failures do not invent payment records.
- **Signup:** public registration is enabled for multi-user use. Set `NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP=false` (and disable “Allow new users” in Supabase Auth) only if you want a locked single-owner deploy.

## Sensitive environment variables

Keep these server-only. Do not prefix them with `NEXT_PUBLIC_`.

| Variable | Used for |
| --- | --- |
| `RESEND_API_KEY` | Sending invoice email |
| `EMAIL_FROM` | From address |
| `STRIPE_SECRET_KEY` | Creating Checkout Sessions |
| `STRIPE_WEBHOOK_SECRET` | Verifying webhook signatures |
| `SUPABASE_SERVICE_ROLE_KEY` | Recording Stripe payments (bypasses RLS; webhook / checkout only) |
| `VAPID_PRIVATE_KEY` | Web Push delivery |

Public:

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Authenticated and public RPC calls |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional Stripe.js |
| `NEXT_PUBLIC_APP_URL` | Public invoice and checkout return URLs |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser PushManager subscribe |
| `NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP` | Set `false` only to lock registration for a single-owner deploy |

## Payments

- Payment amounts are loaded from the database, never trusted from the browser.
- Stripe Checkout charges only the remaining balance and reuses an active session when possible.
- `payments.stripe_checkout_session_id` and `stripe_webhook_events.id` are unique so duplicate deliveries cannot insert twice.
- Invalid public tokens return a generic not-found page.

## Headers

Global responses set `nosniff`, referrer policy, permissions policy, frame denial, production HSTS, and a Content-Security-Policy in Report-Only mode. Public invoice paths override referrer policy to `no-referrer` and disable caching/indexing.

## Backups

Use the backup retention included with the linked Supabase project plan. For a personal MVP, keep the project on a paid plan with daily backups if invoice history must survive an accident. Export is not a substitute for database backups.

See `SECURITY_TESTING.md` for local verification commands and `FreelanceInvoiceTracker_SECURITY_CLEANUP.md` for the hardening plan and live dashboard checklist.
