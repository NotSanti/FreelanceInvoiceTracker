-- Keep connection/checkout writes server-only. Auto-expose can grant INSERT/UPDATE/DELETE
-- to authenticated on new public tables; revoke those and restore SELECT.

revoke insert, update, delete on table public.payment_provider_connections from public, anon, authenticated;
revoke insert, update, delete on table public.payment_checkouts from public, anon, authenticated;
revoke all on table public.payment_provider_connection_secrets from public, anon, authenticated;
revoke all on table public.payment_webhook_events from public, anon, authenticated;
revoke all on table public.payment_oauth_states from public, anon, authenticated;
revoke update on table public.payments from authenticated;

grant select on table public.payment_provider_connections to authenticated;
grant select on table public.payment_checkouts to authenticated;
