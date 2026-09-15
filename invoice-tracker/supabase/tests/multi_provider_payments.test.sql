-- Milestone B: provider-neutral payment schema, RLS, and backfill.

begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function pg_temp.make_user(p_id uuid, p_email text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    provider_id
  )
  values (
    p_id,
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    now(),
    now(),
    now(),
    p_id::text
  );
end;
$$;

create or replace function pg_temp.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user_id,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
end;
$$;

create or replace function pg_temp.clear_auth()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Schema assertions
-- ---------------------------------------------------------------------------

select ok(
  (
    select rowsecurity
    from pg_tables
    where schemaname = 'public' and tablename = 'payment_provider_connections'
  ),
  'payment_provider_connections has RLS enabled'
);

select ok(
  (
    select rowsecurity
    from pg_tables
    where schemaname = 'public'
      and tablename = 'payment_provider_connection_secrets'
  ),
  'payment_provider_connection_secrets has RLS enabled'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.payment_provider_connections',
    'select'
  ),
  'anonymous role cannot read provider connections'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.payment_provider_connection_secrets',
    'select'
  ),
  'authenticated users cannot read token-secret table'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.payment_webhook_events',
    'select'
  ),
  'authenticated cannot read webhook event ledger'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.payment_checkouts',
    'insert'
  ),
  'authenticated cannot insert payment checkouts'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

select pg_temp.make_user(
  '11111111-1111-4111-8111-111111111111',
  'user-a@example.com'
);
select pg_temp.make_user(
  '22222222-2222-4222-8222-222222222222',
  'user-b@example.com'
);

insert into public.clients (id, user_id, name, email)
values
  (
    '77777777-7777-4333-8333-777777777777',
    '11111111-1111-4111-8111-111111111111',
    'Client A',
    'client-a@example.com'
  ),
  (
    '88888888-8888-4333-8333-888888888888',
    '22222222-2222-4222-8222-222222222222',
    'Client B',
    'client-b@example.com'
  );

insert into public.invoices (
  id,
  user_id,
  client_id,
  invoice_number,
  status,
  currency,
  issue_date,
  due_date,
  subtotal_cents,
  discount_cents,
  tax_cents,
  total_cents
)
values
  (
    '55555555-5555-4333-8333-555555555555',
    '11111111-1111-4111-8111-111111111111',
    '77777777-7777-4333-8333-777777777777',
    'INV-A-001',
    'sent',
    'CAD',
    current_date,
    current_date + 14,
    10000,
    0,
    0,
    10000
  ),
  (
    '66666666-6666-4333-8333-666666666666',
    '22222222-2222-4222-8222-222222222222',
    '88888888-8888-4333-8333-888888888888',
    'INV-B-001',
    'sent',
    'CAD',
    current_date,
    current_date + 14,
    20000,
    0,
    0,
    20000
  );

insert into public.payment_provider_connections (
  id,
  user_id,
  provider,
  provider_account_id,
  status,
  connected_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'stripe',
    'acct_user_a',
    'connected',
    now()
  ),
  (
    '44444444-4444-4333-8333-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'stripe',
    'acct_user_b',
    'connected',
    now()
  );

insert into public.payment_provider_connection_secrets (
  connection_id,
  access_token_ciphertext
)
values (
  '33333333-3333-4333-8333-333333333333',
  'ciphertext-not-for-clients'
);

-- ---------------------------------------------------------------------------
-- Isolation
-- ---------------------------------------------------------------------------

select pg_temp.authenticate_as('11111111-1111-4111-8111-111111111111');
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.payment_provider_connections
    where user_id = '22222222-2222-4222-8222-222222222222'
  ),
  0,
  'user A cannot read user B provider connections'
);

select is(
  (
    select count(*)::integer
    from public.payment_provider_connections
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  1,
  'user A can read their own provider connections'
);

select throws_ok(
  $$
    insert into public.invoice_payment_methods (
      invoice_id,
      user_id,
      provider
    )
    values (
      '66666666-6666-4333-8333-666666666666',
      '11111111-1111-4111-8111-111111111111',
      'stripe'
    )
  $$,
  '23503',
  'user A cannot attach a payment method to user B invoice'
);

select lives_ok(
  $$
    insert into public.payments (
      user_id,
      invoice_id,
      amount_cents,
      currency,
      paid_on,
      method
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4333-8333-555555555555',
      2500,
      'CAD',
      current_date,
      'e-transfer'
    )
  $$,
  'existing manual payments still work'
);

select throws_ok(
  $$
    insert into public.payments (
      user_id,
      invoice_id,
      amount_cents,
      currency,
      paid_on,
      method,
      provider,
      provider_payment_id
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4333-8333-555555555555',
      1000,
      'CAD',
      current_date,
      'stripe',
      'stripe',
      'pi_forged'
    )
  $$,
  '42501',
  'users cannot insert provider-confirmed payments'
);

reset role;
select pg_temp.clear_auth();

select throws_ok(
  $$
    insert into public.payment_checkouts (
      user_id,
      invoice_id,
      provider,
      provider_connection_id,
      amount_cents,
      currency
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4333-8333-555555555555',
      'stripe',
      '44444444-4444-4333-8333-444444444444',
      5000,
      'CAD'
    )
  $$,
  '23503',
  'user A cannot attach user B connection to an invoice'
);

-- ---------------------------------------------------------------------------
-- Constraints and backfill
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.invoice_payment_methods (invoice_id, user_id, provider)
    values
      (
        '55555555-5555-4333-8333-555555555555',
        '11111111-1111-4111-8111-111111111111',
        'stripe'
      ),
      (
        '55555555-5555-4333-8333-555555555555',
        '11111111-1111-4111-8111-111111111111',
        'paypal'
      ),
      (
        '55555555-5555-4333-8333-555555555555',
        '11111111-1111-4111-8111-111111111111',
        'square'
      )
  $$,
  'one invoice can enable all three providers'
);

select throws_ok(
  $$
    insert into public.payment_provider_connections (
      user_id,
      provider,
      provider_account_id
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      'venmo',
      'acct_bad'
    )
  $$,
  '23514',
  'unsupported providers fail DB constraints'
);

insert into public.payments (
  user_id,
  invoice_id,
  amount_cents,
  currency,
  paid_on,
  method,
  stripe_checkout_session_id,
  stripe_payment_intent_id
)
values (
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4333-8333-555555555555',
  4000,
  'CAD',
  current_date,
  'stripe',
  'cs_test_backfill',
  'pi_test_backfill'
);

select is(
  (
    select provider
    from public.payments
    where stripe_checkout_session_id = 'cs_test_backfill'
  ),
  'stripe',
  'existing Stripe rows survive and backfill provider'
);

select is(
  (
    select provider_payment_id
    from public.payments
    where stripe_checkout_session_id = 'cs_test_backfill'
  ),
  'pi_test_backfill',
  'existing Stripe rows backfill provider_payment_id'
);

select throws_ok(
  $$
    insert into public.payments (
      user_id,
      invoice_id,
      amount_cents,
      currency,
      paid_on,
      method,
      stripe_checkout_session_id,
      stripe_payment_intent_id
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4333-8333-555555555555',
      500,
      'CAD',
      current_date,
      'stripe',
      'cs_test_dup',
      'pi_test_backfill'
    )
  $$,
  '23505',
  '(provider, provider_payment_id) cannot duplicate'
);

-- ---------------------------------------------------------------------------
-- Checkout + disconnect + deletes
-- ---------------------------------------------------------------------------

insert into public.payment_checkouts (
  id,
  user_id,
  invoice_id,
  provider,
  provider_connection_id,
  provider_checkout_id,
  amount_cents,
  currency,
  status
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4333-8333-555555555555',
  'stripe',
  '33333333-3333-4333-8333-333333333333',
  'cs_live_checkout',
  4000,
  'CAD',
  'completed'
);

update public.payment_provider_connections
set
  status = 'disconnected',
  disconnected_at = now()
where id = '33333333-3333-4333-8333-333333333333';

delete from public.payment_provider_connection_secrets
where connection_id = '33333333-3333-4333-8333-333333333333';

select is(
  (
    select count(*)::integer
    from public.payments
    where stripe_checkout_session_id = 'cs_test_backfill'
  ),
  1,
  'historical payment records are not lost on connection disconnect'
);

select throws_ok(
  $$
    delete from public.payment_provider_connections
    where id = '33333333-3333-4333-8333-333333333333'
  $$,
  '23503',
  'connection with checkout history cannot be deleted'
);

delete from public.invoices
where id = '55555555-5555-4333-8333-555555555555';

select is(
  (
    select count(*)::integer
    from public.invoice_payment_methods
    where invoice_id = '55555555-5555-4333-8333-555555555555'
  ),
  0,
  'deleting invoice removes payment-method selections'
);

select is(
  (
    select count(*)::integer
    from public.payment_checkouts
    where invoice_id = '55555555-5555-4333-8333-555555555555'
  ),
  0,
  'deleting invoice removes payment checkouts'
);

select is(
  (
    select count(*)::integer
    from public.payments
    where invoice_id = '55555555-5555-4333-8333-555555555555'
  ),
  0,
  'deleting invoice cascades its payment rows'
);

delete from auth.users
where id = '22222222-2222-4222-8222-222222222222';

select is(
  (
    select count(*)::integer
    from public.payment_provider_connections
    where user_id = '22222222-2222-4222-8222-222222222222'
  ),
  0,
  'deleting user removes active connection records'
);

select * from finish();
rollback;
