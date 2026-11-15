-- FlowParse backend normalisation
--
-- The original MVP stored a document, its extraction state, and its rows in
-- `statements` and `transactions`. This migration introduces the production
-- entities requested by the product spec while preserving every existing row:
--
--   profiles             one per auth user, with a subscription plan
--   subscription_plans   catalogue of plans and limits
--   uploaded_documents   source PDF metadata (renamed from statements)
--   conversion_jobs      one row per extraction attempt, including progress
--   extracted_transactions  rows produced by a job or by the editor
--   usage_records        monthly usage counters per user
--
-- Access is protected by RLS. Clients never receive the service-role key, and
-- the processor writes through service-role-only functions.

-- ---------------------------------------------------------------------------
-- 1. Rename the original tables and their columns
-- ---------------------------------------------------------------------------

alter table public.statements rename to uploaded_documents;
alter table public.transactions rename to extracted_transactions;
alter table public.extracted_transactions rename column statement_id to document_id;

alter index public.statements_user_created_idx
  rename to uploaded_documents_user_created_idx;
alter index public.statements_status_idx
  rename to uploaded_documents_status_idx;
alter index public.transactions_statement_sort_idx
  rename to extracted_transactions_document_sort_idx;
alter index public.transactions_user_idx
  rename to extracted_transactions_user_idx;
alter index public.transactions_needs_review_idx
  rename to extracted_transactions_needs_review_idx;

alter table public.extracted_transactions
  rename constraint transactions_have_amount to extracted_transactions_have_amount;

alter trigger statements_set_updated_at on public.uploaded_documents
  rename to uploaded_documents_set_updated_at;
alter trigger transactions_set_updated_at on public.extracted_transactions
  rename to extracted_transactions_set_updated_at;
alter trigger statements_track_progress on public.uploaded_documents
  rename to uploaded_documents_track_progress;

comment on table public.uploaded_documents is
  'A private source PDF uploaded by a user, plus the current extraction summary.';
comment on table public.extracted_transactions is
  'Structured ledger rows belonging to an uploaded document.';

-- ---------------------------------------------------------------------------
-- 2. Subscription plans and profiles
-- ---------------------------------------------------------------------------

create table public.subscription_plans (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  price_display text not null default '',
  cadence text not null default 'month',
  statement_limit integer not null check (statement_limit > 0),
  batch_limit integer not null check (batch_limit > 0),
  file_size_mb integer not null check (file_size_mb > 0),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (
  id, name, description, price_display, cadence, statement_limit,
  batch_limit, file_size_mb, features, is_active, sort_order
)
values
  (
    'free',
    'Free',
    'Everything you need to convert and review statements, with a monthly statement allowance.',
    '£0',
    'forever',
    25,
    10,
    25,
    jsonb_build_array(
      '25 statements per month',
      'Digital and scanned PDFs',
      'Editable ledger and reconciliation',
      'CSV and Excel exports'
    ),
    true,
    10
  ),
  (
    'team',
    'Team',
    'Higher limits and shared workflows for finance teams.',
    '£29',
    'month',
    500,
    20,
    25,
    jsonb_build_array(
      '500 statements per month',
      'Higher batch limits',
      'Priority processing',
      'Team workspace (coming soon)'
    ),
    false,
    20
  )
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      price_display = excluded.price_display,
      cadence = excluded.cadence,
      statement_limit = excluded.statement_limit,
      batch_limit = excluded.batch_limit,
      file_size_mb = excluded.file_size_mb,
      features = excluded.features,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order,
      updated_at = now();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default ''
    check (char_length(display_name) <= 120),
  company text check (company is null or char_length(company) <= 160),
  plan_id text not null default 'free'
    references public.subscription_plans(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Account profile for an auth user. Plan changes are restricted to billing.';

-- Backfill existing auth users before installing the trigger.
insert into public.profiles (id, email, display_name, created_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  u.created_at
from auth.users u
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Conversion jobs
-- ---------------------------------------------------------------------------

create table public.conversion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null
    references public.uploaded_documents(id) on delete cascade,
  attempt integer not null default 1 check (attempt > 0),
  status text not null default 'queued'
    check (status in ('uploaded', 'queued', 'processing', 'completed', 'partial', 'failed')),
  processing_stage text
    check (processing_stage is null or char_length(processing_stage) <= 160),
  progress_percent smallint
    check (progress_percent is null or progress_percent between 0 and 100),
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, attempt)
);

comment on table public.conversion_jobs is
  'One extraction attempt for a document. Retrying a failed document creates a new attempt.';
comment on column public.conversion_jobs.progress_percent is
  'Real processor progress for this attempt, from 0 to 100.';

create index conversion_jobs_user_created_idx
  on public.conversion_jobs (user_id, created_at desc);
create index conversion_jobs_document_attempt_idx
  on public.conversion_jobs (document_id, attempt desc);
create index conversion_jobs_status_idx
  on public.conversion_jobs (status, updated_at);

alter table public.extracted_transactions
  add column if not exists job_id uuid;

-- Every existing document becomes attempt 1 so old rows remain linked.
with new_jobs as (
  insert into public.conversion_jobs (
    id, user_id, document_id, attempt, status, processing_stage,
    progress_percent, error_message, started_at, finished_at, created_at, updated_at
  )
  select
    gen_random_uuid(),
    d.user_id,
    d.id,
    1,
    d.status,
    d.processing_stage,
    d.progress_percent,
    d.error_message,
    case
      when d.status in ('processing', 'completed', 'partial', 'failed')
        then d.created_at
      else null
    end,
    d.processed_at,
    d.created_at,
    d.updated_at
  from public.uploaded_documents d
  where not exists (
    select 1 from public.conversion_jobs j where j.document_id = d.id
  )
  returning id, document_id
)
update public.extracted_transactions t
set job_id = j.id
from new_jobs j
where t.document_id = j.document_id
  and t.job_id is null;

alter table public.extracted_transactions
  add constraint extracted_transactions_job_id_fkey
  foreign key (job_id) references public.conversion_jobs(id) on delete set null;

create index extracted_transactions_job_idx
  on public.extracted_transactions (job_id);

create trigger conversion_jobs_set_updated_at
before update on public.conversion_jobs
for each row execute function public.set_updated_at();

create or replace function public.track_conversion_job_progress()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('completed', 'partial') then
      new.processing_stage := case
        when new.status = 'partial' then 'Extraction finished - review needed'
        else 'Extraction complete'
      end;
      new.progress_percent := 100;
      new.finished_at := coalesce(new.finished_at, now());
    elsif new.status = 'failed' then
      new.processing_stage := 'Extraction failed';
      new.progress_percent := 100;
      new.finished_at := coalesce(new.finished_at, now());
    elsif new.status = 'processing' then
      new.started_at := coalesce(new.started_at, now());
      new.finished_at := null;
    elsif new.status = 'queued' then
      new.processing_stage := null;
      new.progress_percent := null;
      new.started_at := null;
      new.finished_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger conversion_jobs_track_progress
before update on public.conversion_jobs
for each row execute function public.track_conversion_job_progress();

-- ---------------------------------------------------------------------------
-- 4. Usage records and triggers
-- ---------------------------------------------------------------------------

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null
    check (period_start = date_trunc('month', period_start)::date),
  documents_uploaded integer not null default 0 check (documents_uploaded >= 0),
  conversions_completed integer not null default 0
    check (conversions_completed >= 0),
  conversions_failed integer not null default 0 check (conversions_failed >= 0),
  storage_bytes bigint not null default 0 check (storage_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

comment on table public.usage_records is
  'Monthly usage counters. Clients can read their own records; triggers maintain them.';

create index usage_records_user_period_idx
  on public.usage_records (user_id, period_start desc);

insert into public.usage_records (
  user_id, period_start, documents_uploaded, conversions_completed,
  conversions_failed, storage_bytes
)
select
  d.user_id,
  date_trunc('month', d.created_at)::date,
  count(*)::integer,
  count(*) filter (where d.status in ('completed', 'partial'))::integer,
  count(*) filter (where d.status = 'failed')::integer,
  coalesce(sum(d.file_size), 0)
from public.uploaded_documents d
group by d.user_id, date_trunc('month', d.created_at)
on conflict (user_id, period_start) do update
  set documents_uploaded = excluded.documents_uploaded,
      conversions_completed = excluded.conversions_completed,
      conversions_failed = excluded.conversions_failed,
      storage_bytes = excluded.storage_bytes,
      updated_at = now();

create trigger usage_records_set_updated_at
before update on public.usage_records
for each row execute function public.set_updated_at();

create or replace function public.track_document_insert_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', new.created_at)::date;
begin
  insert into public.usage_records (
    user_id, period_start, documents_uploaded, storage_bytes
  )
  values (new.user_id, v_period, 1, new.file_size)
  on conflict (user_id, period_start) do update
    set documents_uploaded = public.usage_records.documents_uploaded + 1,
        storage_bytes = public.usage_records.storage_bytes + excluded.storage_bytes,
        updated_at = now();
  return new;
end;
$$;

create trigger uploaded_documents_insert_usage
after insert on public.uploaded_documents
for each row execute function public.track_document_insert_usage();

create or replace function public.track_document_status_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', new.created_at)::date;
begin
  if new.status is distinct from old.status then
    if new.status in ('completed', 'partial') then
      insert into public.usage_records (user_id, period_start, conversions_completed)
      values (new.user_id, v_period, 1)
      on conflict (user_id, period_start) do update
        set conversions_completed = public.usage_records.conversions_completed + 1,
            updated_at = now();
    elsif new.status = 'failed' then
      insert into public.usage_records (user_id, period_start, conversions_failed)
      values (new.user_id, v_period, 1)
      on conflict (user_id, period_start) do update
        set conversions_failed = public.usage_records.conversions_failed + 1,
            updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

create trigger uploaded_documents_status_usage
after update of status on public.uploaded_documents
for each row execute function public.track_document_status_usage();

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
      storage_bytes = greatest(0, storage_bytes - old.file_size),
      updated_at = now()
  where user_id = old.user_id and period_start = v_period;
  return old;
end;
$$;

create trigger uploaded_documents_delete_usage
after delete on public.uploaded_documents
for each row execute function public.track_document_delete_usage();

-- ---------------------------------------------------------------------------
-- 5. Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.conversion_jobs enable row level security;
alter table public.usage_records enable row level security;
alter table public.uploaded_documents enable row level security;
alter table public.extracted_transactions enable row level security;

-- Replace the original policies with document terminology and the extra
-- ownership checks needed by the new tables.
drop policy if exists "Users can view their own statements" on public.uploaded_documents;
drop policy if exists "Users can create their own statements" on public.uploaded_documents;
drop policy if exists "Users can update their own statements" on public.uploaded_documents;
drop policy if exists "Users can delete their own statements" on public.uploaded_documents;
drop policy if exists "Users can view their own transactions" on public.extracted_transactions;
drop policy if exists "Users can create transactions for their own statements" on public.extracted_transactions;
drop policy if exists "Users can update their own transactions" on public.extracted_transactions;
drop policy if exists "Users can delete their own transactions" on public.extracted_transactions;

create policy "Users can view their own documents"
on public.uploaded_documents for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own documents"
on public.uploaded_documents for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own documents"
on public.uploaded_documents for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own documents"
on public.uploaded_documents for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own extracted transactions"
on public.extracted_transactions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create rows for their own documents"
on public.extracted_transactions for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.uploaded_documents d
    where d.id = document_id and d.user_id = auth.uid()
  )
  and (
    job_id is null
    or exists (
      select 1 from public.conversion_jobs j
      where j.id = job_id and j.document_id = document_id
    )
  )
);

create policy "Users can update their own extracted transactions"
on public.extracted_transactions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own extracted transactions"
on public.extracted_transactions for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Anyone can view subscription plans"
on public.subscription_plans for select
to anon, authenticated
using (true);

create policy "Users can view their own conversion jobs"
on public.conversion_jobs for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own usage records"
on public.usage_records for select
to authenticated
using (auth.uid() = user_id);

-- Clients never write jobs or usage directly. The queue/fail functions and the
-- processor's service-role functions perform those writes after ownership
-- checks. Profiles expose only the fields users may edit.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, company) on public.profiles to authenticated;

revoke all on public.subscription_plans from anon, authenticated;
grant select on public.subscription_plans to anon, authenticated;

revoke all on public.usage_records from anon, authenticated;
grant select on public.usage_records to authenticated;

revoke all on public.conversion_jobs from anon, authenticated;
grant select on public.conversion_jobs to authenticated;

revoke all on public.uploaded_documents from anon;
grant select, insert, update, delete on public.uploaded_documents to authenticated;

revoke all on public.extracted_transactions from anon;
grant select, insert, update, delete on public.extracted_transactions to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Atomic queue/fail functions used by the Next.js API
-- ---------------------------------------------------------------------------

create or replace function public.queue_conversion(p_document_id uuid)
returns public.conversion_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_document public.uploaded_documents;
  v_job public.conversion_jobs;
  v_attempt integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_document
  from public.uploaded_documents
  where id = p_document_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Document not found';
  end if;

  if v_document.status in ('queued', 'processing') then
    select * into v_job
    from public.conversion_jobs
    where document_id = p_document_id
      and status in ('queued', 'processing')
    order by attempt desc
    limit 1;
    if v_job.id is not null then
      return v_job;
    end if;
  end if;

  if v_document.status in ('completed', 'partial') then
    raise exception 'This statement has already been extracted. Upload a new copy to run extraction again.';
  end if;

  if exists (
    select 1 from public.extracted_transactions where document_id = p_document_id
  ) then
    raise exception 'This statement already has saved rows. Retrying extraction would replace them, so upload a new copy instead.';
  end if;

  select coalesce(max(attempt), 0) + 1 into v_attempt
  from public.conversion_jobs
  where document_id = p_document_id;

  insert into public.conversion_jobs (user_id, document_id, attempt, status)
  values (v_user_id, p_document_id, v_attempt, 'queued')
  returning * into v_job;

  update public.uploaded_documents
  set status = 'queued', error_message = null, processed_at = null
  where id = p_document_id;

  return v_job;
end;
$$;

revoke all on function public.queue_conversion(uuid) from public, anon;
grant execute on function public.queue_conversion(uuid) to authenticated;

create or replace function public.fail_conversion(p_job_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.conversion_jobs;
  v_message text := left(
    coalesce(nullif(btrim(p_message), ''), 'Processing failed.'),
    2000
  );
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_job
  from public.conversion_jobs
  where id = p_job_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Conversion not found';
  end if;

  update public.conversion_jobs
  set status = 'failed', error_message = v_message
  where id = p_job_id;

  update public.uploaded_documents
  set status = 'failed', error_message = v_message, processed_at = now()
  where id = v_job.document_id;
end;
$$;

revoke all on function public.fail_conversion(uuid, text) from public, anon;
grant execute on function public.fail_conversion(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Processor functions (service role only)
-- ---------------------------------------------------------------------------

drop function if exists public.save_extraction_result(uuid, jsonb);
drop function if exists public.mark_statement_failed(uuid, text);
drop function if exists public.update_statement_progress(uuid, text, integer);
drop function if exists public.apply_transaction_changes(uuid, jsonb, uuid[]);

create or replace function public.save_extraction_result(
  p_document_id uuid,
  p_job_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_status text := coalesce(p_payload->>'status', 'failed');
  v_summary jsonb := coalesce(p_payload->'summary', '{}'::jsonb);
  v_validation jsonb := coalesce(p_payload->'validation', '{}'::jsonb);
  v_report jsonb := coalesce(p_payload->'report', '{}'::jsonb);
begin
  select user_id into v_user_id
  from public.conversion_jobs
  where id = p_job_id and document_id = p_document_id
  for update;

  if v_user_id is null then
    raise exception 'Conversion job not found';
  end if;

  if v_status not in ('completed', 'partial', 'failed') then
    raise exception 'Invalid extraction status';
  end if;

  delete from public.extracted_transactions where document_id = p_document_id;

  if v_status <> 'failed' then
    insert into public.extracted_transactions (
      document_id,
      job_id,
      user_id,
      txn_date,
      value_date,
      description,
      reference,
      debit,
      credit,
      balance,
      currency,
      page_number,
      sort_index,
      source,
      needs_review,
      review_reasons,
      raw_text
    )
    select
      p_document_id,
      p_job_id,
      v_user_id,
      nullif(r.txn_date, '')::date,
      nullif(r.value_date, '')::date,
      coalesce(r.description, ''),
      nullif(r.reference, ''),
      r.debit,
      r.credit,
      r.balance,
      nullif(r.currency, ''),
      r.page_number,
      coalesce(r.sort_index, 0),
      'extracted',
      coalesce(r.needs_review, false),
      coalesce(r.review_reasons, '[]'::jsonb),
      r.raw_text
    from jsonb_to_recordset(coalesce(p_payload->'transactions', '[]'::jsonb)) as r(
      txn_date text,
      value_date text,
      description text,
      reference text,
      debit numeric,
      credit numeric,
      balance numeric,
      currency text,
      page_number integer,
      sort_index integer,
      needs_review boolean,
      review_reasons jsonb,
      raw_text text
    );
  end if;

  update public.conversion_jobs
  set
    status = v_status,
    error_message = nullif(p_payload->>'error_message', ''),
    finished_at = now()
  where id = p_job_id;

  update public.uploaded_documents
  set
    status = v_status,
    bank_name = nullif(v_summary->>'bank_name', ''),
    account_number_last4 = nullif(v_summary->>'account_number_last4', ''),
    account_holder = nullif(v_summary->>'account_holder', ''),
    statement_start = nullif(v_summary->>'statement_start', '')::date,
    statement_end = nullif(v_summary->>'statement_end', '')::date,
    opening_balance = nullif(v_summary->>'opening_balance', '')::numeric,
    closing_balance = nullif(v_summary->>'closing_balance', '')::numeric,
    currency = nullif(v_summary->>'currency', ''),
    page_count = nullif(v_summary->>'page_count', '')::integer,
    extraction_method = nullif(v_summary->>'extraction_method', ''),
    validation_status = nullif(v_validation->>'status', ''),
    validation = v_validation,
    report = v_report,
    error_message = nullif(p_payload->>'error_message', ''),
    processed_at = now(),
    updated_at = now()
  where id = p_document_id;
end;
$$;

revoke all on function public.save_extraction_result(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_extraction_result(uuid, uuid, jsonb)
  to service_role;

create or replace function public.mark_conversion_failed(
  p_job_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_id uuid;
  v_message text := left(
    coalesce(nullif(btrim(p_message), ''), 'Processing failed.'),
    2000
  );
begin
  select document_id into v_document_id
  from public.conversion_jobs
  where id = p_job_id
  for update;

  if v_document_id is null then
    return;
  end if;

  update public.conversion_jobs
  set status = 'failed', error_message = v_message, finished_at = now()
  where id = p_job_id;

  update public.uploaded_documents
  set status = 'failed', error_message = v_message, processed_at = now()
  where id = v_document_id;
end;
$$;

revoke all on function public.mark_conversion_failed(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_conversion_failed(uuid, text)
  to service_role;

create or replace function public.update_conversion_progress(
  p_job_id uuid,
  p_stage text,
  p_percent integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_id uuid;
  v_stage text := left(coalesce(nullif(btrim(p_stage), ''), 'Processing'), 160);
  v_percent integer := greatest(0, least(100, coalesce(p_percent, 0)));
begin
  update public.conversion_jobs
  set processing_stage = v_stage, progress_percent = v_percent
  where id = p_job_id
    and status in ('queued', 'processing')
  returning document_id into v_document_id;

  if v_document_id is not null then
    update public.uploaded_documents
    set processing_stage = v_stage, progress_percent = v_percent
    where id = v_document_id
      and status in ('queued', 'processing');
  end if;
end;
$$;

revoke all on function public.update_conversion_progress(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.update_conversion_progress(uuid, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 8. Inline editor RPC
-- ---------------------------------------------------------------------------

create or replace function public.apply_transaction_changes(
  p_document_id uuid,
  p_upserts jsonb,
  p_deletes uuid[] default '{}'::uuid[]
)
returns setof public.extracted_transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row jsonb;
  v_id uuid;
  v_next_sort integer;
  v_opening numeric(14, 2);
  v_closing numeric(14, 2);
  v_total_debits numeric(14, 2);
  v_total_credits numeric(14, 2);
  v_computed_closing numeric(14, 2);
  v_difference numeric(14, 2);
  v_transaction_count integer;
  v_needs_review_count integer;
  v_incomplete_rows integer;
  v_running_failures integer;
  v_duplicate_rows integer;
  v_has_balance boolean;
  v_validation_status text;
  v_checks jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select opening_balance, closing_balance
  into v_opening, v_closing
  from public.uploaded_documents
  where id = p_document_id and user_id = v_user_id;

  if not found then
    raise exception 'Document not found';
  end if;

  if p_deletes is not null and array_length(p_deletes, 1) > 0 then
    delete from public.extracted_transactions
    where document_id = p_document_id
      and user_id = v_user_id
      and id = any(p_deletes);
  end if;

  select coalesce(max(sort_index), -1) + 1 into v_next_sort
  from public.extracted_transactions
  where document_id = p_document_id;

  for v_row in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb))
  loop
    v_id := nullif(v_row->>'id', '')::uuid;
    if v_id is null then
      insert into public.extracted_transactions (
        document_id, user_id, txn_date, value_date, description, reference,
        debit, credit, balance, currency, sort_index, source, edited,
        needs_review, review_reasons
      ) values (
        p_document_id,
        v_user_id,
        nullif(v_row->>'date', '')::date,
        nullif(v_row->>'value_date', '')::date,
        coalesce(v_row->>'description', ''),
        nullif(v_row->>'reference', ''),
        nullif(v_row->>'debit', '')::numeric,
        nullif(v_row->>'credit', '')::numeric,
        nullif(v_row->>'balance', '')::numeric,
        nullif(v_row->>'currency', ''),
        v_next_sort,
        'manual',
        true,
        (nullif(v_row->>'date', '') is null
          or coalesce(v_row->>'description', '') = ''
          or (nullif(v_row->>'debit', '') is null and nullif(v_row->>'credit', '') is null)),
        case when (nullif(v_row->>'date', '') is null
          or coalesce(v_row->>'description', '') = ''
          or (nullif(v_row->>'debit', '') is null and nullif(v_row->>'credit', '') is null))
          then '["Incomplete row"]'::jsonb else '[]'::jsonb end
      );
      v_next_sort := v_next_sort + 1;
    else
      update public.extracted_transactions as t
      set
        txn_date = nullif(v_row->>'date', '')::date,
        value_date = nullif(v_row->>'value_date', '')::date,
        description = coalesce(v_row->>'description', ''),
        reference = nullif(v_row->>'reference', ''),
        debit = nullif(v_row->>'debit', '')::numeric,
        credit = nullif(v_row->>'credit', '')::numeric,
        balance = nullif(v_row->>'balance', '')::numeric,
        currency = nullif(v_row->>'currency', ''),
        edited = true,
        review_reasons = (
          select coalesce(jsonb_agg(existing.reason), '[]'::jsonb)
          from jsonb_array_elements_text(t.review_reasons) as existing(reason)
          where existing.reason <> 'Incomplete row'
        ) || case when (nullif(v_row->>'date', '') is null
          or coalesce(v_row->>'description', '') = ''
          or (nullif(v_row->>'debit', '') is null and nullif(v_row->>'credit', '') is null))
          then '["Incomplete row"]'::jsonb else '[]'::jsonb end,
        needs_review = (
          (nullif(v_row->>'date', '') is null
            or coalesce(v_row->>'description', '') = ''
            or (nullif(v_row->>'debit', '') is null and nullif(v_row->>'credit', '') is null))
          or exists (
            select 1
            from jsonb_array_elements_text(t.review_reasons) as existing(reason)
            where existing.reason <> 'Incomplete row'
          )
        )
      where t.id = v_id
        and t.document_id = p_document_id
        and t.user_id = v_user_id;

      if not found then
        raise exception 'Transaction not found';
      end if;
    end if;
  end loop;

  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0),
    count(*)::integer,
    count(*) filter (where needs_review)::integer,
    count(*) filter (
      where txn_date is null
        or btrim(description) = ''
        or (debit is null and credit is null)
    )::integer
  into
    v_total_debits,
    v_total_credits,
    v_transaction_count,
    v_needs_review_count,
    v_incomplete_rows
  from public.extracted_transactions
  where document_id = p_document_id
    and user_id = v_user_id;

  select count(*)::integer
  into v_running_failures
  from (
    select
      balance,
      coalesce(credit, 0) - coalesce(debit, 0) as net_change,
      lag(balance) over (order by sort_index, created_at) as previous_balance
    from public.extracted_transactions
    where document_id = p_document_id
      and user_id = v_user_id
  ) running
  where balance is not null
    and previous_balance is not null
    and abs(balance - (previous_balance + net_change)) > 0.005;

  select count(*)::integer
  into v_duplicate_rows
  from public.extracted_transactions t
  where t.document_id = p_document_id
    and t.user_id = v_user_id
    and exists (
      select 1
      from jsonb_array_elements_text(t.review_reasons) as existing(reason)
      where existing.reason ilike '%potential duplicate%'
    );

  select exists (
    select 1
    from public.extracted_transactions
    where document_id = p_document_id
      and user_id = v_user_id
      and balance is not null
  ) into v_has_balance;

  v_computed_closing := null;
  v_difference := null;
  if v_opening is not null then
    v_computed_closing := round(v_opening + (v_total_credits - v_total_debits), 2);
  end if;
  if v_computed_closing is not null and v_closing is not null then
    v_difference := round(v_closing - v_computed_closing, 2);
  end if;

  v_checks := jsonb_build_array(
    jsonb_build_object(
      'id', 'opening_balance',
      'label', 'Opening balance identified',
      'status', case when v_opening is null then 'not_available' else 'pass' end,
      'detail', case
        when v_opening is null then 'No opening balance was found on the statement.'
        else to_char(v_opening, 'FM999,999,999,990.00')
      end
    ),
    jsonb_build_object(
      'id', 'closing_balance',
      'label', 'Closing balance identified',
      'status', case when v_closing is null then 'not_available' else 'pass' end,
      'detail', case
        when v_closing is null then 'No closing balance was found on the statement.'
        else to_char(v_closing, 'FM999,999,999,990.00')
      end
    ),
    jsonb_build_object(
      'id', 'endpoint_reconciliation',
      'label', 'Opening balance + credits − debits equals closing balance',
      'status', case
        when v_difference is null then 'not_available'
        when abs(v_difference) < 0.005 then 'pass'
        else 'fail'
      end,
      'detail', case
        when v_difference is null then 'Both an opening and closing balance are needed for this check.'
        when abs(v_difference) < 0.005 then 'The statement balances reconcile.'
        else 'Difference of ' || to_char(abs(v_difference), 'FM999,999,999,990.00') || '.'
      end
    ),
    jsonb_build_object(
      'id', 'running_balance',
      'label', 'Running balances reconcile',
      'status', case
        when not v_has_balance then 'not_available'
        when v_running_failures = 0 then 'pass'
        else 'fail'
      end,
      'detail', case
        when not v_has_balance then 'No running balance column was identified.'
        when v_running_failures = 0 then 'Every running balance matches the preceding row.'
        else v_running_failures || ' row(s) do not match the preceding balance.'
      end
    ),
    jsonb_build_object(
      'id', 'row_completeness',
      'label', 'Every row has a date and an amount',
      'status', case when v_incomplete_rows = 0 then 'pass' else 'fail' end,
      'detail', case
        when v_incomplete_rows = 0 then 'All rows are complete.'
        else v_incomplete_rows || ' row(s) need review.'
      end
    ),
    jsonb_build_object(
      'id', 'duplicate_transactions',
      'label', 'No potential duplicate transactions',
      'status', case when v_duplicate_rows = 0 then 'pass' else 'fail' end,
      'detail', case
        when v_duplicate_rows = 0 then 'No duplicate rows were detected.'
        else v_duplicate_rows || ' row(s) look like potential duplicates and were kept for review.'
      end
    )
  );

  if v_difference is null then
    v_validation_status := 'insufficient_data';
  elsif abs(v_difference) < 0.005 and v_running_failures = 0 then
    v_validation_status := 'verified';
  else
    v_validation_status := 'mismatch';
  end if;

  update public.uploaded_documents
  set
    validation = jsonb_build_object(
      'status', v_validation_status,
      'checks', v_checks,
      'opening_balance', v_opening,
      'closing_balance', v_closing,
      'computed_closing_balance', v_computed_closing,
      'difference', v_difference,
      'total_debits', v_total_debits,
      'total_credits', v_total_credits,
      'net_change', round(v_total_credits - v_total_debits, 2),
      'transaction_count', v_transaction_count,
      'needs_review_count', v_needs_review_count,
      'running_balance_failures', v_running_failures,
      'incomplete_rows', v_incomplete_rows,
      'duplicate_transactions', v_duplicate_rows
    ),
    validation_status = v_validation_status,
    updated_at = now()
  where id = p_document_id
    and user_id = v_user_id;

  return query
    select *
    from public.extracted_transactions
    where document_id = p_document_id
      and user_id = v_user_id
    order by sort_index, created_at;
end;
$$;

revoke all on function public.apply_transaction_changes(uuid, jsonb, uuid[])
  from public, anon;
grant execute on function public.apply_transaction_changes(uuid, jsonb, uuid[])
  to authenticated;
