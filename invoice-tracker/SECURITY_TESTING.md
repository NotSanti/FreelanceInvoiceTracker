# Security testing

Local commands and non-secret environment names for reproducing the security cleanup suite.

## Prerequisites

- Node.js matching the project (see `package.json` / CI)
- Docker Desktop running (required for local Supabase)
- Supabase CLI via `npx supabase` (devDependency)

## Non-secret environment variables

Copy `.env.example` to `.env.local`. Use placeholders only in Git.

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server publishable key |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional Stripe.js |
| `NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP` | Set `false` only to disable registration |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; never `NEXT_PUBLIC_` |
| `STRIPE_SECRET_KEY` | Server-only |
| `STRIPE_WEBHOOK_SECRET` | Server-only |
| `RESEND_API_KEY` | Server-only |
| `EMAIL_FROM` | From mailbox |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Server-only |
| `VAPID_SUBJECT` | `mailto:` contact for VAPID |

Never commit real values. Never log public invoice tokens, auth cookies, or Stripe payloads.

## Baseline commands

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm audit --audit-level=high
```

## Local database

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

`db reset` applies every migration from zero. Stop if schema drift appears against a remote project; reconcile before applying.

## Application tests after security changes

```bash
npm test
npm run typecheck
```

Focused suites live under `src/**/*.test.ts` and `supabase/tests/`.

## Baseline recorded 2026-09-08 (pre-hardening)

- `npm test`: 5 files / 20 tests passed
- `npm run typecheck`: passed
- `npm run lint`: ~40 errors / 5 warnings in chart components (known debt; not a security gate yet)
- `npm audit`: critical Vitest GHSA-5xrq-8626-4rwp on `vitest@3.2.4` (patched in Phase 1 to `3.2.6`)

## Post-hardening local status

- `npm test`: 6 files / 29 tests passed (includes `src/lib/security/hardening.test.ts`)
- `npm run typecheck`: passed
- `npm audit`: 0 vulnerabilities
- Local `supabase test db`: requires Docker Desktop; run `npm run db:reset` then `npm run db:test` when available
- Production migrations: run preflight cross-tenant SQL, take a backup, then apply forward migrations in order
