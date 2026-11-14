-- FlowParse MVP schema
-- All access to user data is protected by row-level security. The processor
-- writes through a service-role-only function, never from the browser.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  file_size bigint not null check (file_size > 0),
  mime_type text not null default 'application/pdf',
  status text not null default 'uploaded'
    check (status in ('uploaded', 'queued', 'processing', 'completed', 'partial', 'failed')),
  error_message text,
  page_count integer check (page_count is null or page_count > 0),
  bank_name text,
  account_number_last4 text check (account_number_last4 is null or account_number_last4 ~ '^[0-9]{4}$'),
  account_holder text,
  statement_start date,
  statement_end date,
  opening_balance numeric(14, 2),
  closing_balance numeric(14, 2),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  extraction_method text check (extraction_method in ('digital', 'ocr', 'mixed')),
  validation_status text check (validation_status in ('verified', 'mismatch', 'insufficient_data')),
  validation jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index statements_user_created_idx
  on public.statements (user_id, created_at desc);
create index statements_status_idx
  on public.statements (status);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  txn_date date,
  description text not null default '',
  reference text,
  debit numeric(14, 2) check (debit is null or debit >= 0),
  credit numeric(14, 2) check (credit is null or credit >= 0),
  balance numeric(14, 2),
  page_number integer check (page_number is null or page_number > 0),
  sort_index integer not null default 0,
  source text not null default 'extracted' check (source in ('extracted', 'manual')),
  edited boolean not null default false,
  needs_review boolean not null default false,
  review_reasons jsonb not null default '[]'::jsonb,
  raw_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_have_amount check (debit is not null or credit is not null)
);

create index transactions_statement_sort_idx
  on public.transactions (statement_id, sort_index);
create index transactions_user_idx
  on public.transactions (user_id);
create index transactions_needs_review_idx
  on public.transactions (statement_id) where needs_review;

create trigger statements_set_updated_at
before update on public.statements
for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.statements enable row level security;
alter table public.transactions enable row level security;

create policy "Users can view their own statements"
on public.statements for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own statements"
on public.statements for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own statements"
on public.statements for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own statements"
on public.statements for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own transactions"
on public.transactions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create transactions for their own statements"
on public.transactions for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.statements s
    where s.id = statement_id and s.user_id = auth.uid()
  )
);

create policy "Users can update their own transactions"
on public.transactions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own transactions"
on public.transactions for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Private storage bucket and per-user folder policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'statements',
  'statements',
  false,
  26214400,
  array['application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own statement files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'statements'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload their own statement files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'statements'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own statement files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'statements'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'statements'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own statement files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'statements'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- Processor writes: atomic replace of extracted rows
-- ---------------------------------------------------------------------------

create or replace function public.save_extraction_result(
  p_statement_id uuid,
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
  from public.statements
  where id = p_statement_id
  for update;

  if v_user_id is null then
    raise exception 'Statement not found';
  end if;

  if v_status not in ('completed', 'partial', 'failed') then
    raise exception 'Invalid extraction status';
  end if;

  delete from public.transactions where statement_id = p_statement_id;

  if v_status <> 'failed' then
    insert into public.transactions (
      statement_id,
      user_id,
      txn_date,
      description,
      reference,
      debit,
      credit,
      balance,
      page_number,
      sort_index,
      source,
      needs_review,
      review_reasons,
      raw_text
    )
    select
      p_statement_id,
      v_user_id,
      nullif(r.txn_date, '')::date,
      coalesce(r.description, ''),
      nullif(r.reference, ''),
      r.debit,
      r.credit,
      r.balance,
      r.page_number,
      coalesce(r.sort_index, 0),
      'extracted',
      coalesce(r.needs_review, false),
      coalesce(r.review_reasons, '[]'::jsonb),
      r.raw_text
    from jsonb_to_recordset(coalesce(p_payload->'transactions', '[]'::jsonb)) as r(
      txn_date text,
      description text,
      reference text,
      debit numeric,
      credit numeric,
      balance numeric,
      page_number integer,
      sort_index integer,
      needs_review boolean,
      review_reasons jsonb,
      raw_text text
    );
  end if;

  update public.statements
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
  where id = p_statement_id;
end;
$$;

revoke all on function public.save_extraction_result(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_extraction_result(uuid, jsonb) to service_role;

create or replace function public.mark_statement_failed(
  p_statement_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.statements
  set
    status = 'failed',
    error_message = left(coalesce(nullif(p_message, ''), 'Processing failed.'), 2000),
    processed_at = now(),
    updated_at = now()
  where id = p_statement_id;
end;
$$;

revoke all on function public.mark_statement_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_statement_failed(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- User edits: one atomic save for inline preview changes
-- ---------------------------------------------------------------------------

create or replace function public.apply_transaction_changes(
  p_statement_id uuid,
  p_upserts jsonb,
  p_deletes uuid[] default '{}'::uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row jsonb;
  v_id uuid;
  v_next_sort integer;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.statements
    where id = p_statement_id and user_id = v_user_id
  ) then
    raise exception 'Statement not found';
  end if;

  if p_deletes is not null and array_length(p_deletes, 1) > 0 then
    delete from public.transactions
    where statement_id = p_statement_id
      and user_id = v_user_id
      and id = any(p_deletes);
  end if;

  select coalesce(max(sort_index), -1) + 1 into v_next_sort
  from public.transactions
  where statement_id = p_statement_id;

  for v_row in select value from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb))
  loop
    v_id := nullif(v_row->>'id', '')::uuid;
    if v_id is null then
      insert into public.transactions (
        statement_id, user_id, txn_date, description, reference,
        debit, credit, balance, sort_index, source, edited,
        needs_review, review_reasons
      ) values (
        p_statement_id,
        v_user_id,
        nullif(v_row->>'date', '')::date,
        coalesce(v_row->>'description', ''),
        nullif(v_row->>'reference', ''),
        nullif(v_row->>'debit', '')::numeric,
        nullif(v_row->>'credit', '')::numeric,
        nullif(v_row->>'balance', '')::numeric,
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
      update public.transactions
      set
        txn_date = nullif(v_row->>'date', '')::date,
        description = coalesce(v_row->>'description', ''),
        reference = nullif(v_row->>'reference', ''),
        debit = nullif(v_row->>'debit', '')::numeric,
        credit = nullif(v_row->>'credit', '')::numeric,
        balance = nullif(v_row->>'balance', '')::numeric,
        edited = true,
        needs_review = (nullif(v_row->>'date', '') is null
          or coalesce(v_row->>'description', '') = ''
          or (nullif(v_row->>'debit', '') is null and nullif(v_row->>'credit', '') is null)),
        review_reasons = case when (nullif(v_row->>'date', '') is null
          or coalesce(v_row->>'description', '') = ''
          or (nullif(v_row->>'debit', '') is null and nullif(v_row->>'credit', '') is null))
          then '["Incomplete row"]'::jsonb else '[]'::jsonb end
      where id = v_id
        and statement_id = p_statement_id
        and user_id = v_user_id;

      if not found then
        raise exception 'Transaction not found';
      end if;
    end if;
    v_count := v_count + 1;
  end loop;

  update public.statements
  set updated_at = now()
  where id = p_statement_id and user_id = v_user_id;

  return v_count;
end;
$$;

revoke all on function public.apply_transaction_changes(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.apply_transaction_changes(uuid, jsonb, uuid[]) to authenticated;
