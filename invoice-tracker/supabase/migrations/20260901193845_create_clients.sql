-- Invoice recipients for the owner workspace.
-- Applied remotely as migration 20260901193845.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  company_name text,
  email text not null,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  province text,
  postal_code text,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_name_not_empty check (char_length(trim(name)) > 0),
  constraint clients_email_not_empty check (char_length(trim(email)) > 0)
);

comment on table public.clients is
  'Invoice recipients owned by a single workspace user.';

create index clients_user_id_name_idx on public.clients (user_id, name);

alter table public.clients enable row level security;

create policy "Users can select their own clients"
  on public.clients
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own clients"
  on public.clients
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own clients"
  on public.clients
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own clients"
  on public.clients
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row
  execute function private.set_updated_at();

grant select, insert, update, delete on table public.clients to authenticated;
revoke all on table public.clients from anon;
