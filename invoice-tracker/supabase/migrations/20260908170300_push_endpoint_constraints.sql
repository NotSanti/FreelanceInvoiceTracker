-- SEC-07: Bound push subscription fields and tighten RLS predicates.

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_length,
  drop constraint if exists push_subscriptions_p256dh_length,
  drop constraint if exists push_subscriptions_auth_length,
  drop constraint if exists push_subscriptions_user_agent_length,
  drop constraint if exists push_subscriptions_endpoint_https;

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_length
    check (char_length(endpoint) between 16 and 2048),
  add constraint push_subscriptions_p256dh_length
    check (char_length(p256dh) between 16 and 512),
  add constraint push_subscriptions_auth_length
    check (char_length(auth) between 8 and 256),
  add constraint push_subscriptions_user_agent_length
    check (user_agent is null or char_length(user_agent) <= 512),
  add constraint push_subscriptions_endpoint_https
    check (endpoint like 'https://%');

drop policy if exists "Users can select their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete their own push subscriptions" on public.push_subscriptions;

create policy "Users can select their own push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own push subscriptions"
  on public.push_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own push subscriptions"
  on public.push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
