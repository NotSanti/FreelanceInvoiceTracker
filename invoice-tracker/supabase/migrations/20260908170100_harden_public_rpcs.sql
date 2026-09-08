-- SEC-06 / SEC-08: Harden privileged public invoice RPCs.
-- Empty search_path, fully qualified names, no public_token echo,
-- view marker writes only when viewed_at is null.

create or replace function public.get_public_invoice(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'invoice', jsonb_build_object(
      'invoice_number', i.invoice_number,
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
      'is_gst_qst_registered', p.is_gst_qst_registered,
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
set search_path = ''
as $$
  update public.invoices as i
  set viewed_at = now()
  where i.public_token = p_token
    and i.status in ('sent', 'paid')
    and i.viewed_at is null;
$$;

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

revoke all on function public.get_public_invoice(uuid) from public;
revoke all on function public.get_public_invoice(uuid) from anon, authenticated;
revoke all on function public.mark_public_invoice_viewed(uuid) from public;
revoke all on function public.mark_public_invoice_viewed(uuid) from anon, authenticated;
revoke all on function public.get_invoice_checkout_state(uuid) from public;
revoke all on function public.get_invoice_checkout_state(uuid) from anon, authenticated;

grant execute on function public.get_public_invoice(uuid) to anon, authenticated;
grant execute on function public.mark_public_invoice_viewed(uuid) to anon, authenticated;
grant execute on function public.get_invoice_checkout_state(uuid) to service_role;
