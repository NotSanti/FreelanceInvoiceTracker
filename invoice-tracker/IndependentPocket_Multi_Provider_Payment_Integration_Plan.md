# IndependentPocket — Multi-Provider Payment Integration Plan

> Repository: `NotSanti/FreelanceInvoiceTracker`  
> App: IndependentPocket  
> Reviewed: 2026-09-09  
> Goal: let each freelancer connect **their own Stripe, PayPal, and/or Square account** and accept secure invoice payments without IndependentPocket receiving, holding, settling, or manually processing client funds.

---

## 1. Product and payment architecture

IndependentPocket is an **invoice/payment orchestration layer**, not the merchant receiving the freelancer's invoice revenue.

```text
Freelancer
   │
   ├── connects Stripe
   ├── connects PayPale
   └── connects Square
           │
           ▼
       creates invoice
           │
           ▼
         client
           │
   ┌───────┼────────┐
   ▼       ▼        ▼
Stripe   PayPal   Square
   │       │        │
   └── provider-hosted payment flow
           │
           ▼
 Freelancer's provider account
           │
           ▼
 Freelancer's bank
```

IndependentPocket may:
- obtain delegated permission to act on the freelancer's provider account;
- create a provider-hosted checkout/payment request for an invoice;
- redirect the client to that provider;
- receive signed provider webhooks;
- store non-sensitive transaction metadata;
- update invoice payment state after authoritative provider confirmation.

IndependentPocket must not:
- collect or store card numbers, CVVs, client bank credentials, or raw payment credentials;
- mark an invoice paid from a browser success/return URL;
- trust invoice amount/currency/user IDs supplied by the browser;
- route freelancer invoice revenue through an IndependentPocket merchant balance when direct-to-seller settlement is available;
- log OAuth tokens, secrets, Authorization headers, or webhook secrets;
- take an application/platform fee in the first implementation.

### Provider model

| Provider | Integration | Recipient of client funds | IndependentPocket role |
|---|---|---|---|
| Stripe | Stripe Connect + connected seller + direct charge/connected-account Checkout | Freelancer's connected Stripe account | SaaS platform |
| PayPal | PayPal platform/multiparty seller onboarding + Checkout/Orders | Freelancer's PayPal seller account | Platform/partner integration |
| Square | Square OAuth + seller-scoped API + hosted Payment Link | Freelancer's Square seller account | OAuth application |

> Important: IndependentPocket still needs developer/platform application registrations with all three providers. These identify the software and authorize API access; they do **not** mean IndependentPocket must receive invoice funds.

---

## 2. Existing repository state

The repo already has the right base stack:
- Next.js App Router / TypeScript / React;
- Supabase Auth/Postgres/RLS;
- Vitest and Supabase DB tests;
- public invoice route under `src/app/(public)/invoice/[publicToken]`;
- Stripe routes under `src/app/api/stripe/{checkout,webhook}`;
- `stripe` package already installed;
- server-only env conventions;
- `payments` table and a public invoice checkout-state SQL function.

Relevant current paths:

```text
invoice-tracker/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── invoices/
│   │   │   ├── settings/
│   │   │   └── taxes/
│   │   ├── (public)/invoice/[publicToken]/
│   │   └── api/
│   │       ├── stripe/checkout/
│   │       └── stripe/webhook/
│   ├── components/
│   ├── lib/
│   └── types/
├── supabase/
│   ├── migrations/
│   │   ├── 20260901210000_create_payments.sql
│   │   ├── 20260901212000_public_invoice_and_indexes.sql
│   │   └── 20260901212500_invoice_checkout_state.sql
│   └── tests/
├── .env.example
└── package.json
```

The current `payments` table is Stripe-specific through:

```text
stripe_checkout_session_id
stripe_payment_intent_id
```

and its payment method constraint includes `stripe` beside manual methods.

**Do not** extend this with `paypal_order_id`, `square_payment_id`, etc. Migrate to a provider-neutral model.

---

## 3. Non-negotiable security rules

### 3.1 Provider webhook is authoritative

```text
Provider webhook
  ↓
verify signature/authenticity
  ↓
check event/account/invoice/amount/currency
  ↓
write payment idempotently
  ↓
derive invoice paid state
```

Never:

```text
/payment/success -> mark paid
```

### 3.2 Financial values come from the database

Public checkout request may contain:

```json
{ "invoiceToken": "...", "provider": "square" }
```

It must not be allowed to choose authoritative financial/account data:

```json
{ "amount": 1, "currency": "CAD", "userId": "..." }
```

Server flow:
1. Validate public invoice token.
2. Load invoice.
3. Compute outstanding balance from server data.
4. Load invoice owner.
5. Confirm selected provider is enabled for the invoice.
6. Load a usable provider connection belonging to that owner.
7. Create hosted checkout with authoritative amount/currency.
8. Persist checkout attempt.
9. Return only safe checkout data/URL.

### 3.3 Secrets stay server-only

Never expose through `NEXT_PUBLIC_*`:
- OAuth client secrets;
- provider access/refresh tokens;
- Stripe secret key;
- PayPal secret;
- Square secret;
- webhook verification secrets;
- encryption key.

### 3.4 Least privilege

Ask providers only for permissions needed to:
- identify the connected seller;
- create/read invoice payment transactions;
- receive/verify payment state;
- disconnect/revoke integration.

Avoid unrelated customer/catalog/payout/admin scopes.

---

## 4. Provider-neutral domain layer

Create:

```text
src/lib/payments/
├── types.ts
├── errors.ts
├── registry.ts
├── repository.server.ts
├── crypto.server.ts
├── oauth-state.server.ts
├── checkout.server.ts
├── reconcile.server.ts
├── webhooks.server.ts
└── providers/
    ├── stripe.server.ts
    ├── paypal.server.ts
    └── square.server.ts
```

Every credential-bearing module must import `server-only`.

### Types

```ts
export type PaymentProvider = "stripe" | "paypal" | "square";

export type ProviderConnectionStatus =
  | "pending"
  | "connected"
  | "restricted"
  | "disconnected"
  | "error";

export type ProviderCheckoutStatus =
  | "created"
  | "pending"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";
```

Keep manual methods separate:

```ts
export type ManualPaymentMethod =
  | "e-transfer"
  | "cash"
  | "cheque"
  | "bank_transfer"
  | "other";
```

### Adapter interface

```ts
export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;

  getConnectUrl(params: {
    userId: string;
    state: string;
    redirectUri: string;
  }): Promise<string>;

  completeConnection(params: {
    code: string;
    redirectUri: string;
  }): Promise<ProviderConnectionResult>;

  refreshConnection?(
    connection: PaymentProviderConnection
  ): Promise<ProviderConnectionResult>;

  disconnect(connection: PaymentProviderConnection): Promise<void>;

  createCheckout(params: {
    invoice: CheckoutInvoice;
    connection: PaymentProviderConnection;
    successUrl: string;
    cancelUrl: string;
  }): Promise<ProviderCheckoutResult>;

  verifyWebhook(request: Request): Promise<ProviderWebhookEvent>;

  mapWebhookToPaymentEvent(
    event: ProviderWebhookEvent
  ): Promise<NormalizedPaymentEvent | null>;
}
```

Normalized webhook event:

```ts
export interface NormalizedPaymentEvent {
  provider: PaymentProvider;
  providerEventId: string;
  providerPaymentId: string;
  providerCheckoutId?: string;
  providerAccountId: string;
  invoiceId?: string;
  amountCents: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  occurredAt: string;
  metadata?: Record<string, unknown>;
}
```

Do not over-generalize provider-specific onboarding. Normalize only what IndependentPocket actually needs.

---

## 5. Database migration

Create a **new** migration. Do not modify already-applied migrations.

Suggested:

```text
supabase/migrations/20260909XXXXXX_multi_provider_payments.sql
```

### 5.1 `payment_provider_connections`

```sql
create table public.payment_provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  status text not null default 'pending',

  display_name text,
  email text,
  country text,
  default_currency text,
  charges_enabled boolean,
  payouts_enabled boolean,

  provider_metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint provider_connection_provider_check
    check (provider in ('stripe','paypal','square')),
  constraint provider_connection_status_check
    check (status in ('pending','connected','restricted','disconnected','error')),
  unique(user_id, provider)
);
```

### 5.2 Secret table

Prefer a server-private table:

```sql
create table public.payment_provider_connection_secrets (
  connection_id uuid primary key
    references public.payment_provider_connections(id) on delete cascade,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
```

Rules:
- no `anon` grants;
- no ordinary `authenticated` read/write grants;
- service-role/server repository only;
- Stripe may not need per-account token persistence depending on chosen Connect flow/current Stripe guidance.

### 5.3 `invoice_payment_methods`

```sql
create table public.invoice_payment_methods (
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (invoice_id, provider),
  constraint invoice_payment_method_provider_check
    check (provider in ('stripe','paypal','square'))
);
```

This permits per-invoice selection instead of assuming every connected provider must appear everywhere.

### 5.4 `payment_checkouts`

```sql
create table public.payment_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null,
  provider_connection_id uuid not null
    references public.payment_provider_connections(id) on delete restrict,
  provider_checkout_id text,
  amount_cents bigint not null,
  currency text not null,
  status text not null default 'created',
  checkout_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_checkout_amount_positive check (amount_cents > 0)
);

create unique index payment_checkouts_external_unique
on public.payment_checkouts(provider, provider_checkout_id)
where provider_checkout_id is not null;
```

### 5.5 Generalize `payments`

Add:

```text
provider
provider_payment_id
provider_checkout_id
provider_account_id
provider_fee_cents
provider_metadata
```

Backfill current Stripe fields into the generic fields. Keep old Stripe columns temporarily for rollback compatibility; remove them only in a later cleanup migration after production verification.

Create:

```sql
create unique index payments_provider_payment_unique
on public.payments(provider, provider_payment_id)
where provider is not null and provider_payment_id is not null;
```

This is a primary idempotency defense.

### 5.6 `payment_webhook_events`

```sql
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_account_id text,
  processing_status text not null default 'received',
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id)
);
```

### 5.7 OAuth state storage

Create short-lived single-use state storage with:

```text
hashed_state
user_id
provider
return_path
expires_at
consumed_at
```

Never use callback query `userId` as identity.

### 5.8 RLS

Users may:
- read their own non-secret connection metadata;
- manage payment methods on their own invoices;
- read their own checkout/payment history.

Users must not:
- read provider secret/token records;
- insert arbitrary provider-confirmed successful payments;
- attach another user's connection to their invoice;
- directly set a webhook-created payment to completed.

Webhook/service-role code owns authoritative provider writes.

---

## 6. Database test gate

Before any real provider API work, add tests for:

1. User A cannot read User B provider connections.
2. User A cannot attach User B connection to an invoice.
3. Anonymous role cannot read provider connections.
4. Authenticated users cannot read token-secret table.
5. `(provider, provider_payment_id)` cannot duplicate.
6. One invoice can enable all three providers.
7. Unsupported providers fail DB constraints.
8. Existing manual payments still work.
9. Existing Stripe rows survive/backfill correctly.
10. Deleting user removes active connection records.
11. Deleting invoice removes payment-method selections/checkouts.
12. Historical payment records are not lost on connection disconnect.

Run:

```bash
npm run db:test
npm run typecheck
npm run test
npm run lint
npm run build
```

**Do not continue while newly introduced failures exist.**

---

## 7. Token encryption

Create `src/lib/payments/crypto.server.ts`.

Environment:

```text
PAYMENT_TOKEN_ENCRYPTION_KEY=
```

Use authenticated encryption such as AES-256-GCM:
- strong 256-bit key;
- fresh IV/nonce per encrypted value;
- authentication tag;
- versioned ciphertext envelope;
- tamper detection;
- future key-rotation path.

Example stored envelope:

```json
{
  "v": 1,
  "alg": "A256GCM",
  "iv": "...",
  "tag": "...",
  "ciphertext": "..."
}
```

Never log plaintext tokens or decrypted provider responses.

---

## 8. Generic API routes

Target:

```text
src/app/api/payments/
├── connect/[provider]/route.ts
├── callback/[provider]/route.ts
├── disconnect/[provider]/route.ts
├── checkout/route.ts
└── webhooks/
    ├── stripe/route.ts
    ├── paypal/route.ts
    └── square/route.ts
```

Transition strategy:
1. Keep old `/api/stripe/*` routes operational.
2. Build new generic core.
3. Add new Stripe Connect path through generic core.
4. Validate in test mode.
5. Point UI/public invoice to new route.
6. Deprecate old Stripe merchant-checkout route.
7. Remove only after regression verification.

---

## 9. Shared checkout service

Create `src/lib/payments/checkout.server.ts`.

`POST /api/payments/checkout` receives only:

```ts
{
  publicInvoiceToken: string;
  provider: "stripe" | "paypal" | "square";
}
```

Server must:
1. resolve invoice from token;
2. reject draft/void/fully-paid invoices;
3. calculate current outstanding cents;
4. load owner connection;
5. ensure connection belongs to owner;
6. ensure provider is enabled on invoice;
7. ensure connection is usable;
8. create `payment_checkouts` row;
9. call adapter;
10. store provider external checkout ID/URL;
11. return safe redirect URL.

Rate-limit public checkout creation by IP + invoice/provider to prevent abuse.

---

## 10. Shared reconciliation service

Create `src/lib/payments/reconcile.server.ts`.

For each normalized successful provider event validate:

```text
provider
provider event ID
provider account ID
provider payment ID
provider checkout ID/reference
invoice ID
amount
currency
final status
```

Against:

```text
payment_provider_connections
payment_checkouts
invoices
payments
```

Then transactionally:
- record webhook event if new;
- update checkout state;
- insert payment if new;
- preserve exact received amount;
- allow invoice paid state to remain derived from accumulated payments.

Never trust provider metadata alone when the corresponding local checkout/account cannot be validated.

---

# 11. Stripe Connect implementation

## 11.1 Desired model

Use Stripe Connect as a **SaaS platform** where the freelancer/connected account is the merchant and receives payout. Prefer Stripe's Stripe-owned pricing/direct-charge model for this product goal.

No IndependentPocket application fee initially.

Do not preserve the current architecture if it creates ordinary charges on IndependentPocket's own Stripe merchant account.

## 11.2 What the project owner must provide

You must:
- create/sign in to Stripe;
- enable/configure **Connect** for IndependentPocket;
- use test mode first;
- complete the Connect platform configuration Stripe asks for;
- configure callback/redirect URLs;
- configure webhook endpoint/signing secret;
- provide the server-side Stripe platform secret key;
- provide Connect client/application ID if the selected flow uses Standard OAuth;
- create/use at least one test connected seller;
- complete platform verification before live production use.

Potential env:

```dotenv
STRIPE_SECRET_KEY=
STRIPE_CONNECT_CLIENT_ID=
STRIPE_WEBHOOK_SECRET=
```

Keep `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` only if another UI requires it; hosted redirect Checkout alone may not.

### Suggested endpoints

```text
https://independentpocket.com/api/payments/callback/stripe
https://independentpocket.com/api/payments/webhooks/stripe
```

## 11.3 Cursor rule: verify current Connect generation first

Current Stripe SaaS docs now describe Accounts v2. Stripe also maintains Standard Connect OAuth documentation.

Before implementing onboarding, Cursor must re-check current official docs and use the Connect model actually configured in the Stripe dashboard. Do not blindly copy the old ordinary Checkout route.

Official references:
- https://docs.stripe.com/connect/saas
- https://docs.stripe.com/connect/direct-charges
- https://docs.stripe.com/connect/oauth-reference

## 11.4 Connection flow

Implement:
- authenticated Connect Stripe button;
- CSRF `state` generation;
- Stripe-hosted authorization/onboarding;
- callback state validation;
- save connected account ID;
- inspect account readiness/capabilities;
- mark `connected` only when usable for payment acceptance;
- disconnect/revoke behavior where supported.

For Standard OAuth, current Stripe docs return `stripe_user_id`; current docs also deprecate using per-account OAuth access tokens for normal API calls and recommend platform key + connected-account context. Follow current docs.

## 11.5 Checkout

Create Stripe Checkout **in the connected seller context** and use direct-charge semantics.

Attach local metadata such as:

```text
independentpocket_invoice_id
independentpocket_checkout_id
```

Do not create a destination charge through IndependentPocket unless the architecture is explicitly changed later.

## 11.6 Webhook

Verify Stripe signature against raw request body.

Handle the current relevant events for:
- successful Checkout/payment;
- asynchronous success where enabled;
- failure/expiry;
- connection/account state if needed.

Successful redirect is informational only.

## 11.7 Stripe test gate

Automated:
- connection required;
- wrong owner/account rejected;
- amount from DB only;
- fully paid invoice rejected;
- invalid signature rejected;
- wrong currency rejected;
- wrong amount rejected;
- duplicate event does not duplicate payment;
- success URL cannot mark paid;
- disconnect prevents new checkout.

Manual Stripe test mode:
1. Connect test seller.
2. Enable Stripe on invoice.
3. Open public invoice.
4. Create hosted checkout.
5. Complete test payment.
6. Confirm webhook.
7. Confirm one payment row.
8. Confirm invoice becomes paid.
9. Replay webhook.
10. Confirm no duplicate.
11. Test cancel/expired flow.
12. Disconnect and ensure Stripe disappears/unavailable.

Run complete regression suite before continuing.

---

# 12. Square integration

## 12.1 Desired model

Use:
- Square OAuth 2;
- seller-scoped access token;
- refresh token management;
- Square-hosted Checkout / `CreatePaymentLink`;
- Square payment webhooks.

Square's Payments API attributes the recipient to the seller account identified by the request authorization, which matches this architecture.

Official references:
- https://developer.squareup.com/docs/oauth-api/overview
- https://developer.squareup.com/docs/oauth-api/create-urls-for-square-authorization
- https://developer.squareup.com/reference/square/checkout-api
- https://developer.squareup.com/docs/webhooks/overview
- https://developer.squareup.com/docs/payments-api/webhooks

## 12.2 What the project owner must provide

You must:
- create/sign in to Square Developer;
- create an IndependentPocket Square application;
- configure Sandbox first;
- register OAuth redirect URL;
- provide Sandbox Application ID + Application Secret;
- create/configure webhook URL;
- provide webhook signature key;
- create/use a Square Sandbox seller;
- later repeat with production app configuration.

Environment:

```dotenv
SQUARE_ENVIRONMENT=sandbox
SQUARE_APPLICATION_ID=
SQUARE_APPLICATION_SECRET=
SQUARE_WEBHOOK_SIGNATURE_KEY=
```

Suggested:

```text
https://independentpocket.com/api/payments/callback/square
https://independentpocket.com/api/payments/webhooks/square
```

## 12.3 OAuth

```text
Connect Square
  ↓
/api/payments/connect/square
  ↓
Square authorization page
  ↓
callback code + state
  ↓
validate single-use state
  ↓
ObtainToken
  ↓
encrypt access + refresh token
  ↓
fetch seller/merchant identity
  ↓
save connection
```

Request minimum required scopes only. Re-check exact current permission names before coding.

Implement token refresh.

Subscribe to/handle:

```text
oauth.authorization.revoked
```

by disabling the connection.

## 12.4 Checkout

Prefer `CreatePaymentLink` for a Square-hosted page.

Call it with the seller's OAuth token, not IndependentPocket's personal merchant credentials.

Persist:
- provider checkout/payment-link ID;
- order ID if returned/needed;
- merchant ID;
- location ID if needed;
- checkout URL;
- local invoice/checkout references.

## 12.5 Webhooks

At minimum evaluate current:

```text
payment.created
payment.updated
```

Only final completed state creates recognized received money.

Verify Square webhook signature first.

## 12.6 Square test gate

Automated:
- OAuth bad state rejected;
- token ciphertext not plaintext;
- token refresh path works;
- revoked auth disables connection;
- checkout uses correct seller token;
- duplicate `payment.updated` is safe;
- pending does not mark paid;
- completed does;
- wrong merchant rejected;
- invalid signature rejected.

Manual Sandbox:
1. Connect seller.
2. Verify displayed account/business.
3. Enable Square on invoice.
4. Generate hosted Payment Link.
5. Complete Sandbox payment.
6. Confirm webhook.
7. Confirm one payment row.
8. Replay event.
9. Revoke authorization and confirm disabled state.

Run full suite.

---

# 13. PayPal integration

## 13.1 Desired model

Use PayPal's current platform/multiparty seller-onboarding model:
- onboard freelancer as seller;
- retain seller merchant ID/readiness;
- create checkout/order for that seller;
- settle payment to seller;
- receive provider webhook/capture state.

Current PayPal platform documentation says production Complete Payments Platform access requires **approved partner** status. Sandbox can be implemented/tested before approval.

Therefore production PayPal must stay feature-gated until approval is confirmed.

Official references:
- https://developer.paypal.com/platforms/get-started/
- https://developer.paypal.com/platforms/seller-onboarding
- https://developer.paypal.com/platforms/seller-onboarding/onboarding-checklist/
- https://developer.paypal.com/platforms/checkout/

## 13.2 What the project owner must provide

You must:
- create/sign in to PayPal Developer;
- configure Sandbox platform REST app;
- provide Sandbox Client ID + Client Secret;
- create Sandbox seller and buyer accounts;
- configure seller onboarding return/callback URL;
- configure webhook and provide webhook verification ID/settings;
- request/complete PayPal production partner approval;
- provide partner attribution/BN code when PayPal assigns/requires it;
- add production credentials only after approval.

Environment:

```dotenv
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_PARTNER_ATTRIBUTION_ID=
PAYPAL_WEBHOOK_ID=
```

Suggested:

```text
https://independentpocket.com/api/payments/callback/paypal
https://independentpocket.com/api/payments/webhooks/paypal
```

## 13.3 Seller onboarding

Use current PayPal Seller Onboarding / Partner Referrals flow.

Persist:
- merchant ID;
- onboarding status;
- required capabilities/readiness.

Do not treat possession of a PayPal email address as a valid connected payment account.

## 13.4 Checkout

Use current multiparty Checkout/Orders guidance.

IndependentPocket assumptions:
- one invoice = one seller;
- no multi-seller cart;
- no platform fee initially;
- amount/currency from DB;
- stable local invoice/checkout reference;
- provider-hosted/PayPal-secured UX.

Do not consider Order creation to mean payment completion.

## 13.5 Webhooks

Use current official PayPal webhook verification method.

Normalize final capture/payment success.

Persist relevant IDs:
- PayPal order ID;
- capture/payment ID;
- seller merchant ID;
- amount/currency;
- safe metadata.

## 13.6 PayPal test gate

Automated:
- incomplete seller onboarding cannot be offered;
- amount comes from DB;
- completed capture inserts once;
- duplicate webhook is safe;
- bad webhook verification rejected;
- wrong merchant/amount/currency rejected;
- cancellation does not mark paid.

Manual Sandbox:
1. Onboard seller.
2. Enable PayPal.
3. Open public invoice as Sandbox buyer.
4. Pay.
5. Verify webhook/capture.
6. Verify one payment row.
7. Verify invoice paid state.
8. Replay event.
9. Test cancellation.
10. Test incomplete seller.

Keep live feature flag off until partner approval.

---

## 14. Settings UI

Extend existing Settings with a Payments section.

```text
Payments

Connect the services you already use to receive client payments.
IndependentPocket does not hold your invoice funds.

Stripe
Connected / Needs attention / Not connected
Account: ...
[Connect] [Disconnect]

PayPal
Connected / Needs attention / Not connected
[Connect] [Disconnect]

Square
Connected / Needs attention / Not connected
Business: ...
[Connect] [Disconnect]
```

Never render access/refresh tokens or secret identifiers.

Do not call all providers on every Settings render. Persist last-known state and refresh on connect, checkout, token expiry, revocation webhook, or explicit user refresh.

---

## 15. Invoice editor UX

Add:

```text
Online payment methods
[x] Stripe
[x] PayPal
[ ] Square
```

Only connected/usable providers can be selected.

If none are connected:

```text
Connect a payment provider in Settings → Payments to accept online payments.
```

Store choices in `invoice_payment_methods`.

Invoice creation must still work with zero online methods.

---

## 16. Public invoice UX

For unpaid invoice with usable methods:

```text
Balance due
$1,250.00 CAD

Pay securely

[ Pay with Stripe ]
[ Pay with PayPal ]
[ Pay with Square ]

Payments are processed by the selected payment provider and paid to the
invoice issuer's connected account. IndependentPocket does not hold your funds.
```

Do not show a method if:
- no connection;
- connection is restricted/disconnected;
- provider disabled on invoice;
- charge capability unavailable;
- invoice paid/void;
- currency is unsupported.

Create server helper:

```ts
getInvoiceAvailablePaymentProviders(invoiceId)
```

Public UI should not directly read `payment_provider_connections`.

---

## 17. Email flow

Email should contain one canonical button:

```text
[ View & pay invoice ]
```

Do **not** email provider checkout URLs directly as the main design.

Canonical public invoice page then creates a fresh checkout after the client chooses a method. Benefits:
- supports multiple providers;
- avoids expired provider links;
- reflects provider disconnects;
- recalculates outstanding balance at payment time;
- keeps one stable invoice URL.

---

## 18. Webhook idempotency

Use both:
1. `(provider, provider_event_id)` uniqueness in webhook event ledger;
2. `(provider, provider_payment_id)` uniqueness in payments.

Processing:

```text
receive request
  ↓
verify provider authenticity/signature
  ↓
insert event if new
  ↓
duplicate? return 2xx safely
  ↓
normalize
  ↓
validate seller + checkout + invoice + amount + currency
  ↓
transactionally reconcile
  ↓
mark event processed
  ↓
return 2xx
```

Provider retries must never create duplicate income.

---

## 19. Partial payments, refunds, disputes

For MVP checkout, request the current outstanding balance.

Do not require all future payment rows to equal the original invoice total; preserve exact payment amounts so partial-payment support remains possible.

Do not implement automatic refunds in this milestone. Do not silently delete payment history when a refund/dispute happens.

Leave extension path for:

```text
payment_adjustments
payment_refunds
payment_disputes
```

If provider reports a refund/dispute before full support exists, preserve event safely and surface a review-required state rather than falsely continuing to report clean paid income.

---

## 20. Environment variables

Update `.env.example` with placeholders only:

```dotenv
# Shared
NEXT_PUBLIC_APP_URL=http://localhost:3000
PAYMENT_TOKEN_ENCRYPTION_KEY=

# Stripe Connect platform
STRIPE_SECRET_KEY=
STRIPE_CONNECT_CLIENT_ID=
STRIPE_WEBHOOK_SECRET=
# Keep only if an existing UI still requires it:
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Square application
SQUARE_ENVIRONMENT=sandbox
SQUARE_APPLICATION_ID=
SQUARE_APPLICATION_SECRET=
SQUARE_WEBHOOK_SIGNATURE_KEY=

# PayPal platform
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_PARTNER_ATTRIBUTION_ID=
PAYPAL_WEBHOOK_ID=

# Feature flags
PAYMENTS_STRIPE_ENABLED=true
PAYMENTS_SQUARE_ENABLED=true
PAYMENTS_PAYPAL_ENABLED=false
```

Never commit real values.

---

## 21. Local development

OAuth callbacks and webhooks often need internet-accessible HTTPS URLs.

Use one documented approach:
- Stripe CLI for Stripe webhook forwarding where appropriate;
- ngrok/Cloudflare Tunnel for generic provider callbacks;
- Vercel preview deployment for realistic OAuth testing.

Build callback URLs from trusted configured `NEXT_PUBLIC_APP_URL` plus fixed routes. Do not use user-controlled Host headers to construct OAuth redirects.

---

## 22. Logging and errors

Safe structured logging example:

```json
{
  "provider": "square",
  "eventType": "payment.updated",
  "invoiceId": "...",
  "checkoutId": "...",
  "status": "completed"
}
```

Never log:

```text
access_token
refresh_token
client_secret
Authorization header
webhook secret/signature key
raw credential response
```

Client-safe error:

```text
This payment method is temporarily unavailable.
Choose another payment method or contact the invoice issuer.
```

Internal code can log safe enum such as:

```text
PAYMENT_PROVIDER_CHECKOUT_CREATE_FAILED
```

No raw provider stack/API payload in browser responses.

---

## 23. Disconnect behavior

When freelancer disconnects a provider:
- revoke authorization where provider supports it;
- remove/clear active stored secrets;
- mark connection `disconnected`;
- prevent new checkouts;
- dynamically stop showing provider on public invoices;
- preserve all historical payments and provider identifiers.

Never delete historical accounting/payment records merely because a connection is revoked.

---

## 24. App-fee policy

Initial implementation:

```text
IndependentPocket application fee = 0
```

Do not add:
- Stripe application fees;
- PayPal platform fees;
- Square application fees.

If IndependentPocket monetizes later, a SaaS subscription can remain separate from freelancers' client payments.

---

# 25. Incremental Cursor execution plan

## Milestone A — Audit current payment implementation

Read:
- `AGENTS.md`
- `CLAUDE.md`
- `SECURITY.md`
- `SECURITY_TESTING.md`
- current Stripe checkout route
- current Stripe webhook route
- public invoice route
- invoice payment UI
- payment/public-checkout migrations
- Supabase helpers/tests
- Settings UI

Search for:

```text
stripe_checkout_session_id
stripe_payment_intent_id
/api/stripe
STRIPE_
payments
checkout
webhook
```

Do **not** change behavior yet.

Run baseline:

```bash
npm run typecheck
npm run test
npm run db:test
npm run lint
npm run build
```

Document pre-existing failures separately.

### Exit criteria
- affected files identified;
- current Stripe behavior understood;
- current test baseline recorded.

---

## Milestone B — Generic database schema

Implement Section 5 only.

Requirements:
- additive migration;
- legacy Stripe rows backfilled;
- RLS + constraints;
- DB tests.

### Test

```bash
npm run db:test
npm run typecheck
npm run test
npm run lint
npm run build
```

Old Stripe flow must still compile at this checkpoint.

---

## Milestone C — Payment core

Implement:
- types;
- adapter registry;
- server repository;
- encryption;
- OAuth state;
- checkout service;
- reconciliation skeleton;
- fake provider test adapter.

Test:
- registry;
- invalid provider;
- crypto round-trip;
- unique IVs;
- ciphertext tamper failure;
- OAuth state expiry/single-use/user binding;
- disabled provider rejection;
- owner mismatch rejection;
- DB amount usage.

Run full suite.

---

## Milestone D — Settings UI

Build generic provider cards and server-loaded connection state.

Feature flags may initially mark providers as setup-required.

Test UI/server helpers and full suite.

---

## Milestone E — Stripe Connect migration

Refactor current Stripe flow to connected-account/direct-charge architecture.

Do not delete old route until new flow passes Stripe test mode.

Complete automated + manual Stripe test gate.

Then point public invoice Stripe action to generic endpoint.

Run full suite.

---

## Milestone F — Square OAuth + hosted Payment Links

Implement end-to-end Square connection, refresh, checkout, webhook, revocation.

Complete automated + manual Sandbox gate.

Run full suite.

---

## Milestone G — PayPal Sandbox

Implement seller onboarding and multiparty Sandbox Checkout.

Keep production flag false until PayPal approval is available.

Complete automated + manual Sandbox gate.

Run full suite.

---

## Milestone H — Invoice payment-method selection

Wire `invoice_payment_methods` into create/edit flow.

Test combinations:
- none;
- Stripe only;
- PayPal only;
- Square only;
- all three;
- provider disconnected after invoice send;
- invoice already paid;
- partial prior payment.

Run full suite.

---

## Milestone I — Public invoice multi-provider UX

Add server-calculated provider availability and checkout selection.

Test:
- invalid token;
- no providers;
- unavailable provider tampering;
- successful checkout creation for each adapter;
- rate limit;
- paid/void invoice.

Run full suite.

---

## Milestone J — Webhook hardening

Complete event ledger and provider reconciliation.

Replay every provider webhook at least twice.

Expected result: exactly one recognized payment.

Run full suite.

---

## Milestone K — Production hardening

Complete:
- production callback URLs;
- production secrets;
- webhook configuration;
- feature flags;
- safe logs;
- monitoring/error reporting;
- connection-health UX;
- credential rotation notes;
- payment/legal copy review;
- PayPal production enablement only if partner approval is confirmed.

Run full suite and production build.

---

# 26. Testing requirements after every milestone

Every milestone must follow:

```text
implement
  ↓
add/update tests
  ↓
run targeted tests
  ↓
fix failures
  ↓
run complete regression suite
  ↓
only then continue
```

Mandatory final commands:

```bash
npm run typecheck
npm run test
npm run db:test
npm run lint
npm run build
```

A milestone is not done while a newly introduced failure remains.

### Test pyramid

**Unit / Vitest**
- provider adapters/normalization;
- crypto;
- state validation;
- money conversions;
- availability rules;
- reconciliation rules.

**Route/service tests**
- authentication;
- validation;
- provider API error handling;
- callback behavior;
- checkout construction.

**Supabase DB tests**
- RLS;
- constraints;
- uniqueness;
- cross-user attacks.

**Real provider Sandbox/Test mode**
- connect seller;
- create payment;
- cancel/fail payment;
- receive webhook;
- replay webhook;
- revoke/disconnect seller.

---

# 27. Project-owner access checklist

## Stripe

- [ ] Stripe developer/platform account
- [ ] Connect configured
- [ ] test-mode secret key
- [ ] Connect client/application ID if selected flow needs it
- [ ] callback URL registered
- [ ] webhook endpoint configured
- [ ] webhook signing secret
- [ ] test connected seller
- [ ] production platform verification later

## Square

- [ ] Square Developer account
- [ ] IndependentPocket application
- [ ] Sandbox Application ID
- [ ] Sandbox Application Secret
- [ ] OAuth redirect URL
- [ ] webhook URL
- [ ] webhook signature key
- [ ] Sandbox seller
- [ ] production app configuration later

## PayPal

- [ ] PayPal Developer account
- [ ] Sandbox platform REST app
- [ ] Sandbox Client ID
- [ ] Sandbox Client Secret
- [ ] Sandbox seller
- [ ] Sandbox buyer
- [ ] seller onboarding return URL
- [ ] Sandbox webhook + webhook ID
- [ ] production partner approval request
- [ ] partner attribution / BN code when assigned
- [ ] production credentials after approval

**Do not send these secrets to Cursor in chat prompts or commit them. Put them into local/Vercel environment variables.**

---

# 28. Definition of done

- [ ] User can connect own Stripe account.
- [ ] User can connect own Square account.
- [ ] User can connect own PayPal account in Sandbox, and production is correctly gated/approved.
- [ ] User can independently enable any subset per invoice.
- [ ] Public invoice shows only usable providers.
- [ ] Client uses provider-secured checkout.
- [ ] IndependentPocket never collects raw card credentials.
- [ ] Invoice funds settle to freelancer's provider account, not IndependentPocket.
- [ ] Provider webhook is authoritative.
- [ ] Duplicate webhooks are harmless.
- [ ] Account/amount/currency mismatch is rejected.
- [ ] Generic payment ledger supports all three providers.
- [ ] Existing manual payments continue to work.
- [ ] Provider disconnect preserves historical accounting records.
- [ ] OAuth secrets/tokens are encrypted and inaccessible to users.
- [ ] RLS tests pass.
- [ ] Unit tests pass.
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Production build passes.
- [ ] Real Sandbox/test-mode E2E completed for every enabled provider.

---

# 29. Cursor operating instructions

For **every** milestone:

```text
1. Read this plan and all files affected by the milestone.
2. Read AGENTS.md, CLAUDE.md, SECURITY.md and SECURITY_TESTING.md.
3. Inspect existing repository patterns before adding abstractions.
4. Make the smallest coherent change for this milestone only.
5. Do not refactor unrelated code.
6. Add or update tests in the same change.
7. Run targeted tests and fix failures.
8. Run:
   npm run typecheck
   npm run test
   npm run db:test
   npm run lint
   npm run build
9. Do not proceed while new failures remain.
10. Summarize:
    - files changed
    - migrations made
    - security decisions
    - tests added
    - commands run/results
    - manual setup still required from the project owner
11. Stop when credentials/provider dashboard actions are required.
    Never invent credentials, bypass provider verification, or silently replace the requested architecture.
12. Re-check the official provider documentation immediately before implementing each real integration because APIs/onboarding requirements can change.
```

---

# 30. Initial Cursor prompt

```text
Implement Milestone A only from IndependentPocket_Multi_Provider_Payment_Integration_Plan.md.

Goal:
Audit the current IndependentPocket payment implementation before changing it.

Requirements:
- Read AGENTS.md, CLAUDE.md, SECURITY.md, SECURITY_TESTING.md.
- Inspect the existing Stripe checkout and webhook routes.
- Inspect the public invoice page and payment UI.
- Inspect all payment-related Supabase migrations and tests.
- Search the repository for Stripe-specific fields, environment variables,
  checkout IDs, webhook handling, invoice paid-state derivation, and payment status logic.
- Identify what can remain and what must be generalized.
- Do not modify payment behavior yet.
- Run typecheck, tests, database tests, lint, and build.
- Produce an audit report containing:
  1. existing architecture
  2. affected files
  3. migration risks
  4. current test baseline
  5. blockers/manual requirements
- Do not continue to Milestone B automatically.
```

---

# 31. Final architecture

```text
                          IndependentPocket
                                │
                    ┌───────────┴───────────┐
                    │                       │
            Payment connections        Invoice system
                    │                       │
       ┌────────────┼────────────┐          │
       ▼            ▼            ▼          ▼
 Stripe Connect   PayPal       Square   Public invoice
                  Platform      OAuth        │
       │            │            │          │
       └────────────┴──────┬─────┘          │
                           ▼                │
                    Provider registry <─────┘
                           │
                  create hosted checkout
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
 Stripe Checkout      PayPal Checkout     Square Checkout
       │                   │                   │
       ▼                   ▼                   ▼
 Freelancer Stripe    Freelancer PayPal   Freelancer Square
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                    provider webhooks
                           │
                   signature verification
                           │
                  idempotent reconciliation
                           │
                      payments ledger
                           │
                    invoice paid state
```

> **Central rule:** IndependentPocket knows that money was paid; it does not need to possess the money.

---

## Official references

Stripe:
- https://docs.stripe.com/connect/saas
- https://docs.stripe.com/connect/direct-charges
- https://docs.stripe.com/connect/oauth-reference

Square:
- https://developer.squareup.com/docs/oauth-api/overview
- https://developer.squareup.com/docs/oauth-api/create-urls-for-square-authorization
- https://developer.squareup.com/reference/square/checkout-api
- https://developer.squareup.com/docs/webhooks/overview
- https://developer.squareup.com/docs/payments-api/webhooks

PayPal:
- https://developer.paypal.com/platforms/get-started/
- https://developer.paypal.com/platforms/seller-onboarding
- https://developer.paypal.com/platforms/seller-onboarding/onboarding-checklist/
- https://developer.paypal.com/platforms/checkout/
