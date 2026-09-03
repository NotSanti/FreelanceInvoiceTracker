create or replace function public.get_public_invoice(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'invoice', jsonb_build_object(
      'invoice_number', i.invoice_number,
      'public_token', i.public_token,
      'status', i.status,
      'currency', i.currency,
      'issue_date', i.issue_date,
      'due_date', i.due_date,
      'subtotal_cents', i.subtotal_cents,
      'discount_cents', i.discount_cents,
      'tax_cents', i.tax_cents,
      'tax_name', i.tax_name,
      'tax_rate', i.tax_rate,
      'gst_rate', i.gst_rate,
      'gst_cents', i.gst_cents,
      'qst_rate', i.qst_rate,
      'qst_cents', i.qst_cents,
      'total_cents', i.total_cents,
      'payment_instructions', i.payment_instructions,
      'paid_at', i.paid_at
    ),
    'profile', jsonb_build_object(
      'business_name', p.business_name,
      'display_name', p.display_name,
      'email', p.email,
      'phone', p.phone,
      'address_line_1', p.address_line_1,
      'address_line_2', p.address_line_2,
      'city', p.city,
      'province', p.province,
      'postal_code', p.postal_code,
      'country', p.country,
      'tax_registration_number', p.tax_registration_number,
      'gst_registration_number', p.gst_registration_number,
      'qst_registration_number', p.qst_registration_number
    ),
    'client', jsonb_build_object(
      'name', c.name,
      'company_name', c.company_name,
      'email', c.email,
      'address_line_1', c.address_line_1,
      'address_line_2', c.address_line_2,
      'city', c.city,
      'province', c.province,
      'postal_code', c.postal_code,
      'country', c.country
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'description', ii.description,
          'quantity', ii.quantity,
          'unit_price_cents', ii.unit_price_cents,
          'amount_cents', ii.amount_cents,
          'position', ii.position
        )
        order by ii.position
      )
      from public.invoice_items ii
      where ii.invoice_id = i.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'amount_cents', pay.amount_cents,
          'paid_on', pay.paid_on,
          'method', pay.method
        )
        order by pay.paid_on, pay.created_at
      )
      from public.payments pay
      where pay.invoice_id = i.id
    ), '[]'::jsonb)
  )
  from public.invoices i
  join public.profiles p on p.id = i.user_id
  join public.clients c on c.id = i.client_id
  where i.public_token = p_token
    and i.status in ('sent', 'paid');
$$;

create or replace function public.mark_public_invoice_viewed(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.invoices
  set viewed_at = coalesce(viewed_at, now())
  where public_token = p_token
    and status in ('sent', 'paid');
$$;

revoke all on function public.get_public_invoice(uuid) from public;
revoke all on function public.mark_public_invoice_viewed(uuid) from public;
grant execute on function public.get_public_invoice(uuid) to anon, authenticated;
grant execute on function public.mark_public_invoice_viewed(uuid) to anon, authenticated;

create index if not exists invoices_user_id_idx on public.invoices (user_id);
create index if not exists invoices_client_id_idx on public.invoices (client_id);
create index if not exists invoices_issue_date_idx on public.invoices (issue_date);
create index if not exists invoices_due_date_idx on public.invoices (due_date);
create index if not exists invoices_paid_at_idx on public.invoices (paid_at);
create index if not exists invoices_invoice_number_idx on public.invoices (user_id, invoice_number);
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_expense_date_idx on public.expenses (expense_date);
