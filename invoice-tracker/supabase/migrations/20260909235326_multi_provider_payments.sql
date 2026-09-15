-- Provider-neutral payment connections, checkouts, and webhook ledger.
-- Additive: keep existing Stripe columns and RPCs working.

-- ---------------------------------------------------------------------------
-- 5.1 Connections (non-secret metadata)
-- ---------------------------------------------------------------------------

create table public.payment_provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
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
    check (provider in ('stripe', 'paypal', 'square')),
  constraint provider_connection_status_check
    check (
      status in ('pending', 'connected', 'restricted', 'disconnected', 'error')
    ),
  constraint provider_connection_user_provider_unique unique (user_id, provider),
  constraint payment_provider_connections_id_user_unique unique (id, user_id),
  constraint provider_connection_account_id_length
    check (char_length(provider_account_id) between 1 and 255),
  constraint provider_connection_display_name_length
    check (display_name is null or char_length(display_name) <= 200),
  constraint provider_connection_email_length
    check (email is null or char_length(email) <= 254)
);

create index payment_provider_connections_user_id_idx
  on public.payment_provider_connections (user_id);

create trigger payment_provider_connections_set_updated_at
  before update on public.payment_provider_connections
  for each row
  execute function private.set_updated_at();

comment on table public.payment_provider_connections is
  'Freelancer-connected payment providers. Non-secret metadata only.';

-- ---------------------------------------------------------------------------
-- 5.2 Server-private token storage
-- ---------------------------------------------------------------------------

create table public.payment_provider_connection_secrets (
  connection_id uuid primary key
    references public.payment_provider_connections (id) on delete cascade,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger payment_provider_connection_secrets_set_updated_at
  before update on public.payment_provider_connection_secrets
  for each row
  execute function private.set_updated_at();

comment on table public.payment_provider_connection_secrets is
  'Encrypted provider tokens. Service-role / server repository only.';

-- ---------------------------------------------------------------------------
-- 5.3 Per-invoice provider selection
-- ---------------------------------------------------------------------------

create table public.invoice_payment_methods (
  invoice_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (invoice_id, provider),
  constraint invoice_payment_method_provider_check
    check (provider in ('stripe', 'paypal', 'square')),
  constraint invoice_payment_methods_invoice_owner_fkey
    foreign key (invoice_id, user_id)
    references public.invoices (id, user_id)
    on delete cascade
);

create index invoice_payment_methods_user_id_idx
  on public.invoice_payment_methods (user_id);

comment on table public.invoice_payment_methods is
  'Which connected providers are offered on a given invoice.';

-- ---------------------------------------------------------------------------
-- 5.4 Hosted checkout attempts
-- ---------------------------------------------------------------------------

create table public.payment_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_id uuid not null,
  provider text not null,
  provider_connection_id uuid not null,
  provider_checkout_id text,
  amount_cents bigint not null,
  currency text not null,
  status text not null default 'created',
  checkout_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_checkout_amount_positive check (amount_cents > 0),
  constraint payment_checkout_amount_safe_integer
    check (amount_cents <= 9007199254740991),
  constraint payment_checkout_provider_check
    check (provider in ('stripe', 'paypal', 'square')),
  constraint payment_checkout_status_check
    check (
      status in (
        'created',
        'pending',
        'completed',
        'failed',
        'expired',
        'cancelled'
      )
    ),
  constraint payment_checkout_currency_allowed
    check (currency in ('CAD', 'USD')),
  constraint payment_checkouts_invoice_owner_fkey
    foreign key (invoice_id, user_id)
    references public.invoices (id, user_id)
    on delete cascade,
  constraint payment_checkouts_connection_owner_fkey
    foreign key (provider_connection_id, user_id)
    references public.payment_provider_connections (id, user_id)
    on delete restrict
);

create unique index payment_checkouts_external_unique
  on public.payment_checkouts (provider, provider_checkout_id)
  where provider_checkout_id is not null;

create index payment_checkouts_user_id_idx
  on public.payment_checkouts (user_id);

create index payment_checkouts_invoice_id_idx
  on public.payment_checkouts (invoice_id);

create trigger payment_checkouts_set_updated_at
  before update on public.payment_checkouts
  for each row
  execute function private.set_updated_at();

comment on table public.payment_checkouts is
  'Provider-hosted checkout attempts. Paid state is derived from payments, not this table.';

-- ---------------------------------------------------------------------------
-- 5.5 Generalize payments
-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_checkout_id text,
  add column if not exists provider_account_id text,
  add column if not exists provider_fee_cents bigint,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

alter table public.payments
  drop constraint if exists payments_provider_check,
  drop constraint if exists payments_provider_fee_non_negative;

alter table public.payments
  add constraint payments_provider_check
    check (
      provider is null
      or provider in ('stripe', 'paypal', 'square')
    ),
  add constraint payments_provider_fee_non_negative
    check (provider_fee_cents is null or provider_fee_cents >= 0);

update public.payments
set
  provider = 'stripe',
  provider_checkout_id = coalesce(provider_checkout_id, stripe_checkout_session_id),
  provider_payment_id = coalesce(
    provider_payment_id,
    stripe_payment_intent_id,
    stripe_checkout_session_id
  ),
  provider_metadata = case
    when provider_metadata = '{}'::jsonb then
      jsonb_strip_nulls(
        jsonb_build_object(
          'stripe_checkout_session_id', stripe_checkout_session_id,
          'stripe_payment_intent_id', stripe_payment_intent_id
        )
      )
    else provider_metadata
  end
where method = 'stripe'
   or stripe_checkout_session_id is not null
   or stripe_payment_intent_id is not null;

create unique index if not exists payments_provider_payment_unique
  on public.payments (provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;

create or replace function private.sync_payment_provider_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.method = 'stripe' then
    new.provider := coalesce(new.provider, 'stripe');
    new.provider_checkout_id := coalesce(
      new.provider_checkout_id,
      new.stripe_checkout_session_id
    );
    new.provider_payment_id := coalesce(
      new.provider_payment_id,
      new.stripe_payment_intent_id,
      new.stripe_checkout_session_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists payments_sync_provider_fields on public.payments;
create trigger payments_sync_provider_fields
  before insert or update on public.payments
  for each row
  execute function private.sync_payment_provider_fields();

drop policy if exists "Users can insert their own payments" on public.payments;

create policy "Users can insert their own payments"
  on public.payments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.invoices
      where invoices.id = invoice_id
        and invoices.user_id = (select auth.uid())
    )
    and provider is null
    and provider_payment_id is null
    and provider_checkout_id is null
    and provider_account_id is null
    and method in (
      'e-transfer',
      'cash',
      'cheque',
      'bank_transfer',
      'other'
    )
  );

-- ---------------------------------------------------------------------------
-- 5.6 Webhook event ledger
-- ---------------------------------------------------------------------------

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
  constraint payment_webhook_event_provider_check
    check (provider in ('stripe', 'paypal', 'square')),
  constraint payment_webhook_event_status_check
    check (processing_status in ('received', 'processed', 'error')),
  constraint payment_webhook_events_provider_event_unique
    unique (provider, provider_event_id)
);

create index payment_webhook_events_received_at_idx
  on public.payment_webhook_events (received_at desc);

insert into public.payment_webhook_events (
  provider,
  provider_event_id,
  event_type,
  processing_status,
  processed_at
)
select
  'stripe',
  id,
  event_type,
  'processed',
  processed_at
from public.stripe_webhook_events
on conflict (provider, provider_event_id) do nothing;

create or replace function private.mirror_stripe_webhook_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.payment_webhook_events (
    provider,
    provider_event_id,
    event_type,
    processing_status,
    processed_at
  )
  values (
    'stripe',
    new.id,
    new.event_type,
    'processed',
    new.processed_at
  )
  on conflict (provider, provider_event_id) do nothing;
  return new;
end;
$$;

drop trigger if exists stripe_webhook_events_mirror on public.stripe_webhook_events;
create trigger stripe_webhook_events_mirror
  after insert on public.stripe_webhook_events
  for each row
  execute function private.mirror_stripe_webhook_event();

-- ---------------------------------------------------------------------------
-- 5.7 OAuth state (single-use, hashed)
-- ---------------------------------------------------------------------------

create table public.payment_oauth_states (
  id uuid primary key default gen_random_uuid(),
  hashed_state text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  return_path text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_oauth_state_provider_check
    check (provider in ('stripe', 'paypal', 'square')),
  constraint payment_oauth_states_hashed_state_unique unique (hashed_state),
  constraint payment_oauth_states_return_path_relative
    check (
      return_path is null
      or (
        char_length(return_path) <= 500
        and return_path like '/%'
        and return_path not like '//%'
      )
    )
);

create index payment_oauth_states_user_id_idx
  on public.payment_oauth_states (user_id);

create index payment_oauth_states_expires_at_idx
  on public.payment_oauth_states (expires_at);

comment on table public.payment_oauth_states is
  'Hashed, single-use OAuth state. Identity comes from this row, never from callback userId.';

-- ---------------------------------------------------------------------------
-- 5.8 RLS and grants
-- ---------------------------------------------------------------------------

alter table public.payment_provider_connections enable row level security;
create policy "Users can select their own payment connections"
  on public.payment_provider_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.payment_provider_connection_secrets enable row level security;
-- No policies: service_role bypasses RLS; clients have no grants.

alter table public.invoice_payment_methods enable row level security;
create policy "Users can select payment methods on their invoices"
  on public.invoice_payment_methods
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert payment methods on their invoices"
  on public.invoice_payment_methods
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.invoices
      where invoices.id = invoice_id
        and invoices.user_id = (select auth.uid())
    )
  );

create policy "Users can update payment methods on their invoices"
  on public.invoice_payment_methods
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.invoices
      where invoices.id = invoice_id
        and invoices.user_id = (select auth.uid())
    )
  );

create policy "Users can delete payment methods on their invoices"
  on public.invoice_payment_methods
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.payment_checkouts enable row level security;
create policy "Users can select their own payment checkouts"
  on public.payment_checkouts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.payment_webhook_events enable row level security;
alter table public.payment_oauth_states enable row level security;

revoke all on table public.payment_provider_connections from public, anon, authenticated;
revoke all on table public.payment_provider_connection_secrets from public, anon, authenticated;
revoke all on table public.invoice_payment_methods from public, anon;
revoke all on table public.payment_checkouts from public, anon, authenticated;
revoke all on table public.payment_webhook_events from public, anon, authenticated;
revoke all on table public.payment_oauth_states from public, anon, authenticated;

grant select on table public.payment_provider_connections to authenticated;
grant select, insert, update, delete on table public.invoice_payment_methods to authenticated;
grant select on table public.payment_checkouts to authenticated;
