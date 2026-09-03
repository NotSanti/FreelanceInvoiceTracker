-- Profiles for the single-owner workspace.
-- Applied remotely as migration 20260901193041.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  business_name text not null default '',
  email text not null,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  province text,
  postal_code text,
  country text not null default 'CA',
  default_currency text not null default 'CAD',
  default_tax_name text,
  default_tax_rate numeric(7, 4),
  tax_registration_number text,
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1,
  payment_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_invoice_prefix_not_empty check (char_length(trim(invoice_prefix)) > 0),
  constraint profiles_next_invoice_number_positive check (next_invoice_number >= 1),
  constraint profiles_tax_rate_range check (
    default_tax_rate is null
    or (default_tax_rate >= 0 and default_tax_rate <= 100)
  )
);

comment on column public.profiles.default_tax_rate is
  'Tax rate as a percentage, e.g. 14.975 for 14.975%.';
comment on column public.profiles.payment_instructions is
  'Default payment instructions copied onto new invoices.';

alter table public.profiles enable row level security;

create policy "Users can select their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(split_part(new.email, '@', 1), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

grant select, insert, update on table public.profiles to authenticated;
revoke all on table public.profiles from anon;
