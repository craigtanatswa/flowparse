-- ---------------------------------------------------------------------------
-- FlowParse billing (Dodo Payments)
--
-- Adds the paid plan catalogue, page-based allowances, the billing/subscription
-- mirror used for entitlements, and an idempotent webhook application function.
--
-- Entitlements are stored on public.profiles.plan_id. Only the service role may
-- change them, and only through apply_billing_event(), which is called from the
-- signature-verified webhook handler.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Plans: monthly processed-page allowances
-- ---------------------------------------------------------------------------

alter table public.subscription_plans
  rename column statement_limit to page_limit;

alter table public.subscription_plans
  alter column page_limit drop not null;

alter table public.subscription_plans
  add column unlimited boolean not null default false;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_statement_limit_check;

alter table public.subscription_plans
  add constraint subscription_plans_page_limit_check
  check (
    (unlimited and page_limit is null)
    or (not unlimited and page_limit is not null and page_limit > 0)
  );

update public.subscription_plans
set is_active = false,
    updated_at = now()
where id = 'team';

insert into public.subscription_plans (
  id, name, description, price_display, cadence, page_limit, unlimited,
  batch_limit, file_size_mb, features, is_active, sort_order
)
values
  (
    'free',
    'Free',
    'Get started with basic statement conversion and export, with a small monthly page allowance.',
    '$0',
    'forever',
    3,
    false,
    1,
    25,
    jsonb_build_array(
      '3 processed pages per month',
      'PDF bank statement uploads',
      'Excel and CSV exports',
      'Basic transaction extraction'
    ),
    true,
    10
  ),
  (
    'starter',
    'Starter',
    'For individuals converting statements regularly, with more pages and full exports.',
    '$9',
    'month',
    100,
    false,
    10,
    25,
    jsonb_build_array(
      '100 pages per month',
      'Multiple document uploads',
      'Conversion history',
      'Full export functionality'
    ),
    true,
    20
  ),
  (
    'pro',
    'Pro',
    'For busy professionals who need bulk processing and advanced reconciliation.',
    '$19',
    'month',
    400,
    false,
    25,
    25,
    jsonb_build_array(
      '400 pages per month',
      'Bulk processing',
      'Priority processing',
      'Advanced reconciliation'
    ),
    true,
    30
  ),
  (
    'business',
    'Business',
    'Unlimited pages and higher-volume processing for finance teams.',
    '$39',
    'month',
    null,
    true,
    50,
    25,
    jsonb_build_array(
      'Unlimited pages per month',
      'Higher-volume processing',
      'Bulk exports',
      'Extended conversion history'
    ),
    true,
    40
  )
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      price_display = excluded.price_display,
      cadence = excluded.cadence,
      page_limit = excluded.page_limit,
      unlimited = excluded.unlimited,
      batch_limit = excluded.batch_limit,
      file_size_mb = excluded.file_size_mb,
      features = excluded.features,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order,
      updated_at = now();

comment on column public.subscription_plans.page_limit is
  'Processed pages allowed per calendar month. Null when unlimited is true.';

-- ---------------------------------------------------------------------------
-- 2. Usage: pages processed
-- ---------------------------------------------------------------------------

alter table public.usage_records
  add column pages_processed integer not null default 0
  check (pages_processed >= 0);

update public.usage_records u
set pages_processed = coalesce((
  select sum(coalesce(d.page_count, 0))::integer
  from public.uploaded_documents d
  where d.user_id = u.user_id
    and date_trunc('month', d.created_at)::date = u.period_start
    and d.status in ('completed', 'partial')
), 0);

create or replace function public.track_document_status_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', new.created_at)::date;
  v_was_counted boolean := old.status in ('completed', 'partial');
  v_is_counted boolean := new.status in ('completed', 'partial');
begin
  if new.status is distinct from old.status then
    if new.status in ('completed', 'partial') then
      insert into public.usage_records (
        user_id, period_start, conversions_completed, pages_processed
      )
      values (new.user_id, v_period, 1, coalesce(new.page_count, 0))
      on conflict (user_id, period_start) do update
        set conversions_completed =
              public.usage_records.conversions_completed + 1,
            pages_processed =
              public.usage_records.pages_processed + excluded.pages_processed,
            updated_at = now();
    elsif new.status = 'failed' then
      insert into public.usage_records (user_id, period_start, conversions_failed)
      values (new.user_id, v_period, 1)
      on conflict (user_id, period_start) do update
        set conversions_failed = public.usage_records.conversions_failed + 1,
            updated_at = now();
    end if;

    -- A document that leaves a counted state must release its pages so a
    -- re-run does not consume the allowance twice.
    if v_was_counted and not v_is_counted then
      update public.usage_records
      set pages_processed = greatest(0, pages_processed - coalesce(old.page_count, 0)),
          updated_at = now()
      where user_id = old.user_id and period_start = v_period;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.track_document_delete_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', old.created_at)::date;
begin
  update public.usage_records
  set documents_uploaded = greatest(0, documents_uploaded - 1),
      pages_processed = greatest(
        0,
        pages_processed
          - case when old.status in ('completed', 'partial')
              then coalesce(old.page_count, 0)
              else 0
            end
      ),
      storage_bytes = greatest(0, storage_bytes - old.file_size),
      updated_at = now()
  where user_id = old.user_id and period_start = v_period;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Billing mirror and webhook receipts
-- ---------------------------------------------------------------------------

create table public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dodo_customer_id text,
  dodo_subscription_id text unique,
  dodo_product_id text,
  plan_id text not null default 'free'
    references public.subscription_plans(id) on delete restrict,
  status text not null default 'none'
    check (status in (
      'none', 'pending', 'active', 'past_due', 'on_hold', 'paused',
      'cancelled', 'failed', 'expired'
    )),
  cancel_at_next_billing_date boolean not null default false,
  current_period_end timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_subscriptions is
  'Server-maintained mirror of the Dodo Payments subscription that grants access.';

create unique index billing_subscriptions_customer_idx
  on public.billing_subscriptions (dodo_customer_id)
  where dodo_customer_id is not null;

create trigger billing_subscriptions_set_updated_at
before update on public.billing_subscriptions
for each row execute function public.set_updated_at();

create table public.billing_webhook_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

comment on table public.billing_webhook_events is
  'Processed Dodo webhook ids. The unique id makes webhook handling idempotent.';

alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

create policy "Users can view their own billing subscription"
on public.billing_subscriptions for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.billing_subscriptions from anon, authenticated;
grant select on public.billing_subscriptions to authenticated;
grant all on public.billing_subscriptions to service_role;

revoke all on public.billing_webhook_events from anon, authenticated;
grant all on public.billing_webhook_events to service_role;

-- ---------------------------------------------------------------------------
-- 4. Idempotent webhook application
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

  select last_event_at into v_last_event_at
  from public.billing_subscriptions
  where user_id = p_user_id
  for update;

  if v_last_event_at is not null
     and p_event_at is not null
     and p_event_at < v_last_event_at then
    -- A delayed webhook must not roll back a newer subscription state.
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
