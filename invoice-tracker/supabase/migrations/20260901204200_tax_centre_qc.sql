-- Québec tax-centre fields: GST/QST registration, invoice tax split,
-- expense deductibility, and optional annual tax-profile inputs.

alter table public.profiles
  add column is_gst_qst_registered boolean not null default false,
  add column gst_registration_number text,
  add column qst_registration_number text;

comment on column public.profiles.is_gst_qst_registered is
  'Actual GST/QST registration state. Separate from the small-supplier threshold estimate.';

alter table public.invoices
  add column taxable_subtotal_cents bigint,
  add column gst_rate numeric(7, 4),
  add column gst_cents bigint not null default 0,
  add column qst_rate numeric(7, 4),
  add column qst_cents bigint not null default 0;

update public.invoices
set taxable_subtotal_cents = subtotal_cents - discount_cents;

update public.invoices
set
  gst_rate = 5,
  qst_rate = 9.975,
  gst_cents = round(taxable_subtotal_cents * 5.0 / 100.0),
  qst_cents = tax_cents - round(taxable_subtotal_cents * 5.0 / 100.0)
where tax_rate is not null
  and abs(tax_rate - 14.975) < 0.001
  and tax_cents > 0;

alter table public.invoices
  alter column taxable_subtotal_cents set default 0,
  alter column taxable_subtotal_cents set not null;

alter table public.invoices
  add constraint invoices_gst_qst_non_negative check (gst_cents >= 0 and qst_cents >= 0),
  add constraint invoices_gst_qst_matches_tax check (
    (gst_cents = 0 and qst_cents = 0)
    or (gst_cents + qst_cents = tax_cents)
  );

comment on column public.invoices.gst_cents is
  'GST actually applied on this invoice. Historical rates are preserved.';
comment on column public.invoices.qst_cents is
  'QST actually applied on this invoice. Historical rates are preserved.';

alter table public.expenses
  add column subtotal_cents bigint,
  add column gst_cents bigint not null default 0,
  add column qst_cents bigint not null default 0,
  add column is_tax_deductible boolean not null default true,
  add column business_use_percent numeric(5, 2) not null default 100,
  add column tax_category text,
  add column expense_kind text not null default 'operating',
  add column gst_qst_recovery text not null default 'unsure';

update public.expenses
set
  subtotal_cents = amount_cents,
  tax_category = category
where subtotal_cents is null;

alter table public.expenses
  alter column subtotal_cents set default 0,
  alter column subtotal_cents set not null;

alter table public.expenses
  add constraint expenses_kind_allowed check (expense_kind in ('operating', 'capital')),
  add constraint expenses_recovery_allowed check (
    gst_qst_recovery in ('eligible', 'not_eligible', 'unsure')
  ),
  add constraint expenses_business_use_range check (
    business_use_percent >= 0 and business_use_percent <= 100
  ),
  add constraint expenses_gst_qst_non_negative check (gst_cents >= 0 and qst_cents >= 0),
  add constraint expenses_subtotal_matches_total check (
    amount_cents = subtotal_cents + gst_cents + qst_cents
  );

create table public.tax_year_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year integer not null,
  other_taxable_income_cents bigint not null default 0,
  tax_withheld_cents bigint not null default 0,
  instalments_paid_cents bigint not null default 0,
  other_deductible_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_year_inputs_year_range check (year >= 2000 and year <= 2100),
  constraint tax_year_inputs_amounts_non_negative check (
    other_taxable_income_cents >= 0
    and tax_withheld_cents >= 0
    and instalments_paid_cents >= 0
    and other_deductible_cents >= 0
  ),
  constraint tax_year_inputs_user_year_unique unique (user_id, year)
);

comment on table public.tax_year_inputs is
  'Optional annual personal-tax adjustments used only for planning estimates.';

alter table public.tax_year_inputs enable row level security;

create policy "Users can select their own tax year inputs"
  on public.tax_year_inputs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own tax year inputs"
  on public.tax_year_inputs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tax year inputs"
  on public.tax_year_inputs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tax year inputs"
  on public.tax_year_inputs for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger tax_year_inputs_set_updated_at
  before update on public.tax_year_inputs
  for each row
  execute function private.set_updated_at();

grant select, insert, update, delete on table public.tax_year_inputs to authenticated;
revoke all on table public.tax_year_inputs from anon;
