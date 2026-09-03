-- Invoice domain for the owner workspace.
-- Applied remotely as migration 20260901195059.
-- Stored status is draft/sent/paid/void. Overdue is derived in the app.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  invoice_number text not null,
  public_token uuid not null default gen_random_uuid(),
  status text not null default 'draft',
  currency text not null default 'CAD',
  issue_date date not null,
  due_date date not null,
  subtotal_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  tax_name text,
  tax_rate numeric(7, 4),
  notes text,
  payment_instructions text,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_payment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_status_allowed check (status in ('draft', 'sent', 'paid', 'void')),
  constraint invoices_currency_allowed check (currency in ('CAD', 'USD')),
  constraint invoices_number_not_empty check (char_length(trim(invoice_number)) > 0),
  constraint invoices_money_non_negative check (
    subtotal_cents >= 0
    and discount_cents >= 0
    and tax_cents >= 0
    and total_cents >= 0
  ),
  constraint invoices_discount_not_above_subtotal check (discount_cents <= subtotal_cents),
  constraint invoices_total_matches_parts check (
    total_cents = subtotal_cents - discount_cents + tax_cents
  ),
  constraint invoices_tax_rate_range check (
    tax_rate is null or (tax_rate >= 0 and tax_rate <= 100)
  ),
  constraint invoices_user_number_unique unique (user_id, invoice_number),
  constraint invoices_public_token_unique unique (public_token)
);

comment on column public.invoices.status is
  'Stored status: draft, sent, paid, or void. Overdue is derived, never stored.';
comment on column public.invoices.tax_rate is
  'Tax rate as a percentage copied onto the invoice, e.g. 14.975.';
comment on column public.invoices.subtotal_cents is
  'Integer cents. Never store currency as floating point.';

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(12, 4) not null default 1,
  unit_price_cents bigint not null,
  amount_cents bigint not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_items_description_not_empty check (char_length(trim(description)) > 0),
  constraint invoice_items_quantity_positive check (quantity > 0),
  constraint invoice_items_unit_price_non_negative check (unit_price_cents >= 0),
  constraint invoice_items_amount_non_negative check (amount_cents >= 0)
);

comment on column public.invoice_items.unit_price_cents is
  'Integer cents. Quantity may be decimal; amount_cents is the rounded line total.';

create index invoices_user_id_issue_date_idx on public.invoices (user_id, issue_date desc);
create index invoices_user_id_status_idx on public.invoices (user_id, status);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoice_items_invoice_id_position_idx on public.invoice_items (invoice_id, position);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy "Users can select their own invoices"
  on public.invoices for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own invoices"
  on public.invoices for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own invoices"
  on public.invoices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own invoices"
  on public.invoices for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can select items on their invoices"
  on public.invoice_items for select to authenticated
  using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
        and invoices.user_id = (select auth.uid())
    )
  );

create policy "Users can insert items on their invoices"
  on public.invoice_items for insert to authenticated
  with check (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
        and invoices.user_id = (select auth.uid())
    )
  );

create policy "Users can update items on their invoices"
  on public.invoice_items for update to authenticated
  using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
        and invoices.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
        and invoices.user_id = (select auth.uid())
    )
  );

create policy "Users can delete items on their invoices"
  on public.invoice_items for delete to authenticated
  using (
    exists (
      select 1 from public.invoices
      where invoices.id = invoice_items.invoice_id
        and invoices.user_id = (select auth.uid())
    )
  );

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row
  execute function private.set_updated_at();

create or replace function private.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_next integer;
begin
  if new.invoice_number is not null and btrim(new.invoice_number) <> '' then
    return new;
  end if;

  update public.profiles
  set next_invoice_number = next_invoice_number + 1
  where id = new.user_id
  returning invoice_prefix, next_invoice_number - 1
  into v_prefix, v_next;

  if not found then
    raise exception 'A profile is required before creating invoices.';
  end if;

  new.invoice_number := v_prefix || '-' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

create trigger invoices_assign_number
  before insert on public.invoices
  for each row
  execute function private.assign_invoice_number();

grant select, insert, update, delete on table public.invoices to authenticated;
grant select, insert, update, delete on table public.invoice_items to authenticated;
revoke all on table public.invoices from anon;
revoke all on table public.invoice_items from anon;
