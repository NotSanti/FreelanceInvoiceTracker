create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount_cents bigint not null,
  currency text not null default 'CAD',
  paid_on date not null,
  method text not null,
  reference text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount_cents > 0),
  constraint payments_method_allowed check (
    method in (
      'e-transfer',
      'cash',
      'cheque',
      'bank_transfer',
      'other',
      'stripe'
    )
  )
);

comment on table public.payments is
  'Money received against an invoice. Invoice paid state is derived from these rows.';

create index payments_user_id_idx on public.payments (user_id);
create index payments_invoice_id_idx on public.payments (invoice_id);
create index payments_paid_on_idx on public.payments (paid_on);
create unique index payments_stripe_session_unique
  on public.payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.payments enable row level security;

create policy "Users can select their own payments"
  on public.payments for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own payments"
  on public.payments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.invoices
      where invoices.id = invoice_id
        and invoices.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own payments"
  on public.payments for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on table public.payments to authenticated;
revoke all on table public.payments from anon;

-- Preserve cash-received history for invoices already marked paid.
insert into public.payments (
  user_id,
  invoice_id,
  amount_cents,
  currency,
  paid_on,
  method,
  reference
)
select
  invoices.user_id,
  invoices.id,
  invoices.total_cents,
  invoices.currency,
  coalesce(invoices.paid_at::date, invoices.issue_date),
  'other',
  'Backfilled from paid invoice'
from public.invoices
where invoices.status = 'paid'
  and invoices.total_cents > 0
  and not exists (
    select 1 from public.payments payments where payments.invoice_id = invoices.id
  );
