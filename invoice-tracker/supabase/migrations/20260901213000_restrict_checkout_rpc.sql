-- Checkout state includes internal IDs. Keep it off the public API.
revoke all on function public.get_invoice_checkout_state(uuid) from public;
revoke all on function public.get_invoice_checkout_state(uuid) from anon, authenticated;
grant execute on function public.get_invoice_checkout_state(uuid) to service_role;
