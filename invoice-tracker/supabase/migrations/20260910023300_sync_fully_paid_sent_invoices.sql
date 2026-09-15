update public.invoices as i
set
  status = 'paid',
  paid_at = coalesce(i.paid_at, now())
where i.status = 'sent'
  and i.total_cents > 0
  and coalesce(
    (
      select sum(p.amount_cents)
      from public.payments p
      where p.invoice_id = i.id
    ),
    0
  ) >= i.total_cents;
