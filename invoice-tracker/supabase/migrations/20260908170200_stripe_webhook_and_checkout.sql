-- SEC-02: Idempotent Stripe webhook recording and active checkout session tracking.

alter table public.invoices
  add column if not exists stripe_checkout_amount_cents bigint,
  add column if not exists stripe_checkout_expires_at timestamptz;

alter table public.invoices
  drop constraint if exists invoices_stripe_checkout_amount_positive;

alter table public.invoices
  add constraint invoices_stripe_checkout_amount_positive
  check (
    stripe_checkout_amount_cents is null
    or stripe_checkout_amount_cents > 0
  );

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  stripe_checkout_session_id text,
  invoice_id uuid,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from public;
revoke all on table public.stripe_webhook_events from anon, authenticated;
-- service_role bypasses RLS; no policies granted to clients.

create or replace function public.get_invoice_checkout_state(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'invoice_id', i.id,
    'user_id', i.user_id,
    'invoice_number', i.invoice_number,
    'currency', i.currency,
    'total_cents', i.total_cents,
    'status', i.status,
    'stripe_checkout_session_id', i.stripe_checkout_session_id,
    'stripe_checkout_amount_cents', i.stripe_checkout_amount_cents,
    'stripe_checkout_expires_at', i.stripe_checkout_expires_at,
    'stripe_payment_url', i.stripe_payment_url,
    'paid_cents', coalesce((
      select sum(pay.amount_cents)::bigint
      from public.payments pay
      where pay.invoice_id = i.id
    ), 0)
  )
  from public.invoices i
  where i.public_token = p_token
    and i.status in ('sent', 'paid');
$$;

revoke all on function public.get_invoice_checkout_state(uuid) from public;
revoke all on function public.get_invoice_checkout_state(uuid) from anon, authenticated;
grant execute on function public.get_invoice_checkout_state(uuid) to service_role;

create or replace function public.record_stripe_checkout_payment(
  p_event_id text,
  p_event_type text,
  p_session_id text,
  p_invoice_id uuid,
  p_user_id uuid,
  p_amount_cents bigint,
  p_currency text,
  p_payment_intent_id text,
  p_paid_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_paid_cents bigint;
  v_remaining bigint;
  v_payment_id uuid;
  v_already boolean := false;
begin
  if p_event_id is null or btrim(p_event_id) = '' then
    raise exception 'missing event id' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.stripe_webhook_events e
    where e.id = p_event_id
  ) then
    return jsonb_build_object(
      'duplicate_event', true,
      'payment_created', false
    );
  end if;

  select * into v_invoice
  from public.invoices i
  where i.id = p_invoice_id
    and i.user_id = p_user_id
  for update;

  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;

  if v_invoice.status = 'void' then
    raise exception 'invoice is void' using errcode = 'P0001';
  end if;

  if lower(v_invoice.currency) <> lower(p_currency) then
    raise exception 'currency mismatch' using errcode = '22023';
  end if;

  if p_amount_cents is null
     or p_amount_cents <= 0
     or p_amount_cents > 9007199254740991 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.payments pay
    where pay.stripe_checkout_session_id = p_session_id
  ) then
    v_already := true;
  else
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
      p_user_id,
      p_invoice_id,
      p_amount_cents,
      v_invoice.currency,
      p_paid_on,
      'stripe',
      p_session_id,
      p_payment_intent_id
    )
    returning id into v_payment_id;
  end if;

  insert into public.stripe_webhook_events (
    id,
    event_type,
    stripe_checkout_session_id,
    invoice_id
  )
  values (
    p_event_id,
    p_event_type,
    p_session_id,
    p_invoice_id
  );

  select coalesce(sum(pay.amount_cents), 0)::bigint
  into v_paid_cents
  from public.payments pay
  where pay.invoice_id = p_invoice_id;

  v_remaining := greatest(v_invoice.total_cents - v_paid_cents, 0);

  if v_remaining <= 0 and v_invoice.status <> 'paid' then
    update public.invoices
    set status = 'paid',
        paid_at = coalesce(paid_at, now()),
        stripe_checkout_session_id = null,
        stripe_checkout_amount_cents = null,
        stripe_checkout_expires_at = null,
        stripe_payment_url = null,
        updated_at = now()
    where id = p_invoice_id
      and user_id = p_user_id;
  elsif v_invoice.stripe_checkout_session_id = p_session_id then
    update public.invoices
    set stripe_checkout_session_id = null,
        stripe_checkout_amount_cents = null,
        stripe_checkout_expires_at = null,
        stripe_payment_url = null,
        updated_at = now()
    where id = p_invoice_id
      and user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'duplicate_event', false,
    'payment_created', not v_already,
    'payment_id', v_payment_id,
    'paid_cents', v_paid_cents,
    'remaining_cents', v_remaining,
    'overpaid', v_paid_cents > v_invoice.total_cents,
    'client_id', v_invoice.client_id,
    'invoice_number', v_invoice.invoice_number,
    'total_cents', v_invoice.total_cents,
    'currency', v_invoice.currency
  );
end;
$$;

revoke all on function public.record_stripe_checkout_payment(
  text, text, text, uuid, uuid, bigint, text, text, date
) from public;
revoke all on function public.record_stripe_checkout_payment(
  text, text, text, uuid, uuid, bigint, text, text, date
) from anon, authenticated;
grant execute on function public.record_stripe_checkout_payment(
  text, text, text, uuid, uuid, bigint, text, text, date
) to service_role;

create or replace function public.rotate_invoice_public_token(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_token uuid := gen_random_uuid();
begin
  update public.invoices i
  set public_token = v_new_token,
      stripe_checkout_session_id = null,
      stripe_checkout_amount_cents = null,
      stripe_checkout_expires_at = null,
      stripe_payment_url = null,
      updated_at = now()
  where i.id = p_invoice_id
    and i.user_id = (select auth.uid())
  returning i.public_token into v_new_token;

  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;

  return v_new_token;
end;
$$;

revoke all on function public.rotate_invoice_public_token(uuid) from public;
revoke all on function public.rotate_invoice_public_token(uuid) from anon;
grant execute on function public.rotate_invoice_public_token(uuid) to authenticated;
