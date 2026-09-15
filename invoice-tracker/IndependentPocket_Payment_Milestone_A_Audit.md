# IndependentPocket — Milestone A payment audit

Reviewed: 2026-09-09  
Scope: current Stripe/payments implementation only. **No payment behavior was changed.**  
Plan: `IndependentPocket_Multi_Provider_Payment_Integration_Plan.md`  
Stop: do not continue to Milestone B until explicitly asked.

---

## 1. Existing architecture

IndependentPocket today is a **platform-merchant Stripe Checkout** implementation, not Stripe Connect. Card payments, when the feature flag is on, charge IndependentPocket’s own Stripe account (`STRIPE_SECRET_KEY`). There is no connected seller, no `stripeAccount` / `on_behalf_of`, no destination charge, and no application fee.

Card checkout is **implemented and compiled, but product-gated off**:

```11:12:src/config/payments.ts
/** Card checkout stays in the codebase but is not offered until live Stripe is ready. */
export const STRIPE_CHECKOUT_ENABLED = false;
```

`isStripeCheckoutOffered()` requires that flag **and** a configured secret key. The public pay button therefore does not render in the current product.

### Money flow today

```text
Client (public invoice)
  → POST /api/stripe/checkout { public_token }
  → service-role RPC get_invoice_checkout_state
  → remaining = invoices.total_cents - sum(payments)
  → Stripe Checkout Session on IndependentPocket's account
  → 303 to Stripe-hosted page
  → client returns to /invoice/{token}?checkout=success|cancelled  (informational only)
  → Stripe webhook checkout.session.completed
  → verify signature
  → RPC record_stripe_checkout_payment (FOR UPDATE lock)
  → insert payments row (method = stripe)
  → if remaining <= 0 set invoices.status = paid
  → then (non-durable) owner email / client receipt / push
```

IndependentPocket **does** currently receive client funds on the platform Stripe account. That is the architecture the plan forbids going forward.

### What already matches the plan

- Checkout body is only `public_token`. Amount and currency come from the database.
- Success/cancel URLs do not mark invoices paid. The public page ignores `?checkout=`.
- Webhook verifies Stripe signatures on the raw body.
- Paid state is derived from `payments` rows, not from browser state.
- Duplicate protection: `stripe_webhook_events.id` (Stripe event id) + unique `payments.stripe_checkout_session_id`.
- Email CTA is already **View & pay invoice** → public invoice URL, not a Stripe Checkout URL.
- Manual methods (`e-transfer`, `cash`, `cheque`, `bank_transfer`, `other`) are separate from Stripe.
- Secrets are server-only (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`).
- Checkout and webhook RPCs are `service_role` only.

### What must change

- Replace platform Checkout with **Stripe Connect + connected-account / direct-charge**.
- Generalize Stripe-specific columns and RPCs into provider-neutral tables (`payment_provider_connections`, `payment_checkouts`, generic `payments.provider*` fields, `payment_webhook_events`).
- Do **not** add `paypal_order_id` / `square_payment_id` columns onto the current Stripe shape.
- Keep old `/api/stripe/*` until the generic `/api/payments/*` Stripe Connect path is verified.

---

## 2. Affected files

### Keep and later generalize

| Path | Role today |
| --- | --- |
| `src/app/api/stripe/checkout/route.ts` | Public POST; remaining-balance Checkout; session reuse; 303 to Stripe |
| `src/app/api/stripe/webhook/route.ts` | Signature verify; `checkout.session.completed`; RPC; post-pay notices |
| `src/lib/stripe/client.ts` | Platform `new Stripe(secretKey)` singleton; no Connect context |
| `src/lib/stripe/env.ts` | `STRIPE_*` env + `isStripeCheckoutOffered()` |
| `src/config/payments.ts` | Manual methods, `STRIPE_CHECKOUT_ENABLED`, labels |
| `src/lib/payments/totals.ts` | Remaining/paid math (provider-neutral already) |
| `src/lib/payments/sync.ts` | Manual-path paid-state sync (app, not RPC) |
| `src/lib/public-invoice.ts` | Public invoice + checkout-state loaders |
| `src/lib/supabase/service.ts` | Service-role client for checkout/webhook |
| `src/lib/supabase/proxy.ts` | Public allowlist for `/api/stripe/checkout` and `/api/stripe/webhook` |
| `src/lib/security/rate-limit.ts` | In-process 8/min checkout limit keyed by IP + hashed token |
| `src/app/(public)/invoice/[publicToken]/page.tsx` | Unpaid remaining + optional `PublicPayButton` |
| `src/components/invoices/public-pay-button.tsx` | Form POST to `/api/stripe/checkout`; label “Pay securely” |
| `src/components/invoices/record-payment-dialog.tsx` | Dashboard manual payments |
| `src/app/(dashboard)/invoices/actions.ts` | `recordPayment` |
| `src/lib/email/invoice-email-template.ts` | View & pay → public URL |
| `src/lib/email/send-payment-notice.ts` | Owner notice after Stripe settle |
| `src/lib/email/send-client-payment-receipt.ts` | Client receipt after Stripe settle |
| `src/types/database.ts` | Typed invoices/payments Stripe fields + RPCs |
| `.env.example` | Platform Stripe vars only |
| `SECURITY.md` / `SECURITY_TESTING.md` | Documents current platform-merchant model |

### Settings / invoice editor (no Connect today)

| Path | Role today |
| --- | --- |
| `src/app/(dashboard)/settings/page.tsx` | Profile + push only |
| `src/app/(dashboard)/settings/profile-form.tsx` | Free-text default **payment instructions** |
| Invoice editor payment instructions textarea | Not provider selection |

### Schema / RPCs (additive migration later; do not edit applied files)

| Path | Role |
| --- | --- |
| `supabase/migrations/20260901195059_create_invoices.sql` | Invoice Stripe session/url/intent columns |
| `supabase/migrations/20260901210000_create_payments.sql` | Payments table, RLS, unique Stripe session, method includes `stripe` |
| `supabase/migrations/20260901212000_public_invoice_and_indexes.sql` | Public invoice embeds payment history |
| `supabase/migrations/20260901212500_invoice_checkout_state.sql` | First checkout RPC |
| `supabase/migrations/20260901213000_restrict_checkout_rpc.sql` | service_role-only grant |
| `supabase/migrations/20260908170000_tenant_bound_foreign_keys.sql` | `payments_invoice_owner_fkey` |
| `supabase/migrations/20260908170100_harden_public_rpcs.sql` | Hardened public/checkout RPCs |
| `supabase/migrations/20260908170200_stripe_webhook_and_checkout.sql` | Checkout amount/expiry cols, `stripe_webhook_events`, `record_stripe_checkout_payment` |
| `supabase/migrations/20260908170400_bounded_field_constraints.sql` | Payment amount/reference bounds |
| `supabase/tests/tenant_isolation.test.sql` | Privilege/FK tests; not payment recording |

### Can remain with little change

- Manual payment dialog, methods, and `syncInvoicePaidState`
- Remaining-balance math in `src/lib/payments/totals.ts`
- Public invoice remaining / “How to pay” / payment-instructions copy
- Email “View & pay invoice” pattern
- Receipt / owner-notice side effects after durable recording

### Must be added later (not present)

- `src/lib/payments/` adapter registry, crypto, OAuth state, checkout/reconcile services
- `src/app/api/payments/**`
- Settings Payments connect/disconnect cards
- Per-invoice `invoice_payment_methods` UI
- PayPal / Square packages and env

---

## 3. Migration risks

1. **Active checkout lives on `invoices`**, not `payments`: `stripe_checkout_session_id`, `stripe_checkout_amount_cents`, `stripe_checkout_expires_at`, `stripe_payment_url`. `payments` holds settled `stripe_checkout_session_id` / `stripe_payment_intent_id`. Moving to `payment_checkouts` without dual-write will break session reuse, rotate-token cleanup, and the record RPC.

2. **`invoices.stripe_payment_intent_id` is unused.** Intent IDs are written only on `payments`. Keep the column for rollback; do not treat it as live.

3. **`payments.method` check** allows only `e-transfer|cash|cheque|bank_transfer|other|stripe`. Multi-provider must not stuff PayPal/Square into `method` as a substitute for a `provider` column. Manual methods must keep working.

4. **Idempotency is Stripe-shaped:** unique session id on payments + `stripe_webhook_events` PK = Stripe event id. New uniqueness must be `(provider, provider_payment_id)` and `(provider, provider_event_id)` with a backfill of existing Stripe rows.

5. **`record_stripe_checkout_payment` is Stripe-named and service_role-only.** Webhook route calls it by name. Generalized reconciliation should not silently drop this until the new path is verified.

6. **Composite tenant FKs** (`payments_invoice_owner_fkey`) must be copied onto new tables (`invoice_payment_methods`, `payment_checkouts`) or cross-tenant attachment returns.

7. **Secret table grants** must follow `stripe_webhook_events` (RLS on, no anon/authenticated grants), not `payments` (owners can insert their own manual rows).

8. **Paid status has no `partially_paid`.** Partial money keeps `status = sent`. Preserve exact payment amounts; do not require new rows to equal original invoice total.

9. **Two paid-state writers:** Stripe uses the locking RPC; manual payments use `syncInvoicePaidState` in the app. Generic webhook path should stay server/service-role; do not let authenticated users insert completed provider payments.

10. **Proxy public allowlist** is exact checkout/webhook paths (plus trailing-slash variants). New `/api/payments/webhooks/*` and `/api/payments/checkout` must be added deliberately; do not open all of `/api/payments/*`.

11. **Generated types** omit `stripe_webhook_events`. New tables need a types update.

12. **Feature flag is code, not env.** Plan wants `PAYMENTS_STRIPE_ENABLED` / Square / PayPal env flags. Current `STRIPE_CHECKOUT_ENABLED = false` is a product gate, not Connect.

---

## 4. Current test baseline (2026-09-09)

| Command | Result |
| --- | --- |
| `npm run typecheck` | **Pass** (`next typegen` + `tsc --noEmit`) |
| `npm run test` | **Pass** — 6 files / **29 tests** |
| `npm run db:test` | **Not run** — local Postgres refused (`127.0.0.1:54322`). Docker Desktop is not running. Same gap noted in `SECURITY_TESTING.md`. |
| `npm run lint` | **Fail (pre-existing)** — 40 errors / 5 warnings, all in `src/components/charts/*`. Not payment-related. Matches the documented chart-component debt. |
| `npm run build` | **Pass** — Next.js 16.3.4. Routes include `/api/stripe/checkout` and `/api/stripe/webhook`. |

### What tests cover today

- `src/lib/payments/totals.test.ts` — remaining / fully paid / income-by-date
- `src/lib/email/invoice-email-preview.test.ts` — View & pay + public URL
- `src/lib/security/hardening.test.ts` — public token + rate-limit helpers (not checkout)
- `supabase/tests/tenant_isolation.test.sql` — payments owner FK, checkout RPC privileges, `stripe_webhook_events` RLS, anon cannot select payments

### What tests do **not** cover

- Checkout route, webhook route, session reuse
- `record_stripe_checkout_payment` insert / paid transition / duplicate event
- Success URL cannot mark paid
- Amount/currency from DB only
- Overpayment, void invoice, currency mismatch
- Public pay button / settings Connect (none exists)

These gaps are expected; they are Milestone C+ work, not A.

Pre-existing failures (charts lint; missing local Supabase) are **not** introduced by this audit.

---

## 5. Blockers / manual requirements

None of these are required to start Milestone B (schema). They block later Connect/Sandbox milestones and live enablement.

### Stripe (project owner)

- [ ] Stripe platform account + **Connect** configured (not ordinary merchant Checkout)
- [ ] Test-mode secret key and webhook signing secret (already conceptually in `.env.example`)
- [ ] Connect client/application ID if the chosen onboarding flow needs it (`STRIPE_CONNECT_CLIENT_ID`)
- [ ] Callback URL: `/api/payments/callback/stripe`
- [ ] Webhook endpoint: `/api/payments/webhooks/stripe` (in addition to, then instead of, `/api/stripe/webhook`)
- [ ] At least one test connected seller
- [ ] Confirm current Connect generation (Accounts v2 vs Standard OAuth) from live Stripe docs/dashboard before Milestone E
- [ ] Production platform verification later

### Square (project owner)

- [ ] Square Developer app, Sandbox app id/secret, OAuth redirect, webhook signature key, Sandbox seller

### PayPal (project owner)

- [ ] Sandbox platform REST app, seller + buyer, webhook ID
- [ ] Production partner approval — keep `PAYMENTS_PAYPAL_ENABLED=false` until then

### Local environment (this machine, this audit)

- Docker Desktop was not running, so `npm run db:test` could not connect.
- Before Milestone B DB tests: start Docker, `npx supabase start` (or `npm run db:reset`), then `npm run db:test`.

### Credentials rule

Do not paste secrets into chat. Put them in `.env.local` / Vercel env only.

---

## 6. Security notes for later milestones

Already good:

- Browser never supplies amount/currency/userId.
- Webhook is the settlement authority.
- No application fee in current Checkout create.
- No card data stored.

Known gaps vs the plan (do not “fix” in A):

- Funds settle to IndependentPocket, not the freelancer.
- Webhook does not compare stored `stripe_checkout_amount_cents` to Stripe `amount_total` (currency is checked).
- Checkout rate limit is in-process `Map`, not shared.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` exists but hosted redirect Checkout does not need it.
- No token encryption layer yet (no per-seller OAuth tokens stored).

---

## 7. Exit criteria

- [x] Affected files identified
- [x] Current Stripe behavior understood (platform merchant, flag off, webhook-authoritative)
- [x] Current test baseline recorded
- [x] Payment behavior unchanged
- [x] Stop; do not start Milestone B automatically
