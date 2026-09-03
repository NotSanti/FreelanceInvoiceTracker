-- Toggle for whether invoice tax label/rate defaults are active.

alter table public.profiles
  add column if not exists taxes_enabled boolean not null default true;

comment on column public.profiles.taxes_enabled is
  'When false, tax defaults are inactive and tax fields are hidden on new invoices.';
