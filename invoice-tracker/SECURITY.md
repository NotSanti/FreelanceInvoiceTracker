# Security

This app is a personal invoice tracker. It is not a bank, a tax-filing system, or a card processor.

## Trust boundaries

- **Browser:** receives only the publishable Supabase key and, if online payments are enabled, the Stripe publishable key. It never receives Stripe secrets, Resend keys, or the Supabase service role key.
- **Logged-in owner:** can read and write their own clients, invoices, and payments through Supabase Row Level Security.
- **Public invoice page:** `/invoice/[publicToken]` is unauthenticated. It loads a single invoice through a `security definer` RPC keyed by `public_token`. Internal notes, user IDs, and unrelated invoices are not returned. `get_invoice_checkout_state` is not granted to `anon` or `authenticated`; only the server (service role) may load internal IDs for Stripe Checkout.
- **Stripe:** card details stay on Stripe Checkout. The app never collects or stores card numbers. Opening checkout or returning to a success URL does not mark an invoice paid. The Stripe webhook is the source of truth.
- **Email:** Resend sends invoice PDFs and optional owner payment notices. Failures do not invent payment records.

## Sensitive environment variables

Keep these server-only. Do not prefix them with `NEXT_PUBLIC_`.

| Variable | Used for |
| --- | --- |
| `RESEND_API_KEY` | Sending invoice email |
| `EMAIL_FROM` | From address |
| `STRIPE_SECRET_KEY` | Creating Checkout Sessions |
| `STRIPE_WEBHOOK_SECRET` | Verifying webhook signatures |
| `SUPABASE_SERVICE_ROLE_KEY` | Recording Stripe payments (bypasses RLS; webhook only) |

Public:

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Authenticated and public RPC calls |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional Stripe.js |
| `NEXT_PUBLIC_APP_URL` | Public invoice and checkout return URLs |

## Payments

- Payment amounts are loaded from the database, never trusted from the browser.
- Stripe Checkout charges only the remaining balance.
- `payments.stripe_checkout_session_id` is unique so duplicate webhooks cannot insert twice.
- Invalid public tokens return a generic not-found page.

## Backups

Use the backup retention included with the linked Supabase project plan. For a personal MVP, keep the project on a paid plan with daily backups if invoice history must survive an accident. Export is not a substitute for database backups.
