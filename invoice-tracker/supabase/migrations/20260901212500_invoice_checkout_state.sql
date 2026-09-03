create or replace function public.get_invoice_checkout_state(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'invoice_id', i.id,
    'user_id', i.user_id,
    'invoice_number', i.invoice_number,
    'currency', i.currency,
    'total_cents', i.total_cents,
    'status', i.status,
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

revoke all on function public.get_invoice_checkout_state(uuid) from public;
grant execute on function public.get_invoice_checkout_state(uuid) to anon, authenticated;
