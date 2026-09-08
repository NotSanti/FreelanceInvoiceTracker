-- Schema and privilege assertions for the security hardening migrations.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

select ok(
  exists (
    select 1 from pg_constraint where conname = 'clients_id_user_id_unique'
  ),
  'clients (id, user_id) unique exists'
);

select ok(
  exists (
    select 1 from pg_constraint where conname = 'invoices_client_owner_fkey'
  ),
  'composite invoices_client_owner_fkey exists'
);

select ok(
  exists (
    select 1 from pg_constraint where conname = 'payments_invoice_owner_fkey'
  ),
  'composite payments_invoice_owner_fkey exists'
);

select ok(
  not has_function_privilege('anon', 'public.get_invoice_checkout_state(uuid)', 'execute'),
  'anon cannot execute checkout state'
);

select ok(
  not has_function_privilege('authenticated', 'public.get_invoice_checkout_state(uuid)', 'execute'),
  'authenticated cannot execute checkout state'
);

select ok(
  has_function_privilege('service_role', 'public.get_invoice_checkout_state(uuid)', 'execute'),
  'service_role can execute checkout state'
);

select ok(
  has_function_privilege('anon', 'public.get_public_invoice(uuid)', 'execute'),
  'anon can execute get_public_invoice'
);

select ok(
  has_function_privilege('anon', 'public.mark_public_invoice_viewed(uuid)', 'execute'),
  'anon can execute mark_public_invoice_viewed'
);

select is(
  (
    select proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_public_invoice'
  ),
  array['search_path=""']::text[],
  'get_public_invoice search_path is empty'
);

select is(
  (
    select proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mark_public_invoice_viewed'
  ),
  array['search_path=""']::text[],
  'mark_public_invoice_viewed search_path is empty'
);

select ok(
  exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'stripe_webhook_events'
      and rowsecurity
  ),
  'stripe_webhook_events has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.clients', 'select'),
  'anon cannot select clients'
);

select ok(
  not has_table_privilege('anon', 'public.invoices', 'select'),
  'anon cannot select invoices'
);

select ok(
  not has_table_privilege('anon', 'public.payments', 'select'),
  'anon cannot select payments'
);

select * from finish();
rollback;
