-- SEC-01: Bind invoices to same-owner clients and payments to same-owner invoices.
-- Preflight (must return 0 rows before apply):
--   select i.id from public.invoices i
--   join public.clients c on c.id = i.client_id
--   where i.user_id <> c.user_id;
--   select p.id from public.payments p
--   join public.invoices i on i.id = p.invoice_id
--   where p.user_id <> i.user_id;

alter table public.clients
  add constraint clients_id_user_id_unique unique (id, user_id);

alter table public.invoices
  drop constraint if exists invoices_client_id_fkey;

alter table public.invoices
  add constraint invoices_client_owner_fkey
  foreign key (client_id, user_id)
  references public.clients (id, user_id)
  on delete restrict;

alter table public.invoices
  add constraint invoices_id_user_id_unique unique (id, user_id);

alter table public.payments
  drop constraint if exists payments_invoice_id_fkey;

alter table public.payments
  add constraint payments_invoice_owner_fkey
  foreign key (invoice_id, user_id)
  references public.invoices (id, user_id)
  on delete cascade;

drop policy if exists "Users can insert their own invoices" on public.invoices;
drop policy if exists "Users can update their own invoices" on public.invoices;

create policy "Users can insert their own invoices"
  on public.invoices
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.clients c
      where c.id = client_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own invoices"
  on public.invoices
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.clients c
      where c.id = client_id
        and c.user_id = (select auth.uid())
    )
  );
