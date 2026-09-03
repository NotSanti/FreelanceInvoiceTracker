-- Business expenses for cash-flow and projected net income.
-- Paid vs upcoming is derived from paid_at. Do not persist a status column.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vendor text not null,
  description text,
  category text,
  amount_cents bigint not null,
  currency text not null default 'CAD',
  expense_date date not null,
  due_date date,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_vendor_not_empty check (char_length(trim(vendor)) > 0),
  constraint expenses_amount_positive check (amount_cents > 0),
  constraint expenses_currency_allowed check (currency in ('CAD', 'USD'))
);

comment on table public.expenses is
  'Outgoing business costs owned by a single workspace user. Paid is derived from paid_at.';
comment on column public.expenses.amount_cents is
  'Integer cents. Never store currency as floating point.';
comment on column public.expenses.paid_at is
  'Set when the expense is paid. Upcoming and overdue are derived in the app.';

create index expenses_user_id_expense_date_idx
  on public.expenses (user_id, expense_date desc);

alter table public.expenses enable row level security;

create policy "Users can select their own expenses"
  on public.expenses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own expenses"
  on public.expenses
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own expenses"
  on public.expenses
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own expenses"
  on public.expenses
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row
  execute function private.set_updated_at();

grant select, insert, update, delete on table public.expenses to authenticated;
revoke all on table public.expenses from anon;
