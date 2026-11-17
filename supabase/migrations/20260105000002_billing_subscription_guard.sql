-- ---------------------------------------------------------------------------
-- Billing: ignore superseded subscriptions
--
-- A customer can have more than one Dodo subscription over time (for example
-- after cancelling and subscribing again). Delayed events for the old
-- subscription must not overwrite the subscription that currently grants
-- access. The stored subscription is replaced only when it is not entitled.
-- ---------------------------------------------------------------------------

create or replace function public.apply_billing_event(
  p_webhook_id text,
  p_event_type text,
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_product_id text,
  p_plan_id text,
  p_status text,
  p_cancel_at_next_billing_date boolean,
  p_current_period_end timestamptz,
  p_event_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
  v_last_event_at timestamptz;
  v_current_subscription_id text;
  v_current_status text;
begin
  if p_user_id is null then
    raise exception 'apply_billing_event requires a user id';
  end if;

  if p_plan_id not in ('free', 'starter', 'pro', 'business') then
    raise exception 'Unknown plan %', p_plan_id;
  end if;

  insert into public.billing_webhook_events (id, event_type)
  values (p_webhook_id, p_event_type)
  on conflict (id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  select last_event_at, dodo_subscription_id, status
  into v_last_event_at, v_current_subscription_id, v_current_status
  from public.billing_subscriptions
  where user_id = p_user_id
  for update;

  if v_last_event_at is not null
     and p_event_at is not null
     and p_event_at < v_last_event_at then
    -- A delayed webhook must not roll back a newer subscription state.
    return true;
  end if;

  if v_current_subscription_id is not null
     and p_subscription_id is not null
     and v_current_subscription_id <> p_subscription_id
     and v_current_status in ('active', 'past_due') then
    -- The stored subscription still grants access. Ignore events from a
    -- superseded subscription (cancelled, failed, expired, or pending).
    return true;
  end if;

  insert into public.billing_subscriptions (
    user_id, dodo_customer_id, dodo_subscription_id, dodo_product_id,
    plan_id, status, cancel_at_next_billing_date, current_period_end,
    last_event_at
  )
  values (
    p_user_id, p_customer_id, p_subscription_id, p_product_id,
    p_plan_id, p_status, coalesce(p_cancel_at_next_billing_date, false),
    p_current_period_end, p_event_at
  )
  on conflict (user_id) do update
    set dodo_customer_id =
          coalesce(excluded.dodo_customer_id,
                   public.billing_subscriptions.dodo_customer_id),
        dodo_subscription_id =
          coalesce(excluded.dodo_subscription_id,
                   public.billing_subscriptions.dodo_subscription_id),
        dodo_product_id =
          coalesce(excluded.dodo_product_id,
                   public.billing_subscriptions.dodo_product_id),
        plan_id = excluded.plan_id,
        status = excluded.status,
        cancel_at_next_billing_date = excluded.cancel_at_next_billing_date,
        current_period_end = excluded.current_period_end,
        last_event_at = coalesce(
          excluded.last_event_at,
          public.billing_subscriptions.last_event_at
        ),
        updated_at = now();

  update public.profiles
  set plan_id = p_plan_id,
      updated_at = now()
  where id = p_user_id
    and plan_id is distinct from p_plan_id;

  return true;
end;
$$;

revoke all on function public.apply_billing_event(
  text, text, uuid, text, text, text, text, text, boolean, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_billing_event(
  text, text, uuid, text, text, text, text, text, boolean, timestamptz, timestamptz
) to service_role;
