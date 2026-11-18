-- ---------------------------------------------------------------------------
-- Security and financial-usage hardening
--
--  * Statement rows can no longer be created or mutated directly by clients.
--    Creation and deletion go through ownership-checked RPCs, so a client
--    cannot point a document at another user's storage object, forge a
--    completed status, or change the page count used for billing.
--  * Transaction rows can only reference the owner's document and a job that
--    belongs to that same document.
--  * Processed pages are charged to the calendar month in which processing
--    finished, are strictly capped by the plan allowance at save time, and are
--    not refunded when a document is deleted.
--  * A late or duplicate processor callback can no longer overwrite a
--    completed extraction with a failure or a second result.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Ownership-checked statement creation and deletion
-- ---------------------------------------------------------------------------

create or replace function public.create_statement(
  p_file_name text,
  p_file_size bigint
)
returns table (id uuid, storage_path text, file_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_file_name text := btrim(coalesce(p_file_name, ''));
  v_max_mb integer := 25;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(v_file_name) < 1 or char_length(v_file_name) > 255 then
    raise exception 'Invalid file name';
  end if;
  if v_file_name ~ '[[:cntrl:]]' or v_file_name ~ '[/\\]' then
    raise exception 'Invalid file name';
  end if;
  if v_file_name !~* '\.pdf$' then
    raise exception 'Only PDF files are supported';
  end if;

  select p.file_size_mb into v_max_mb
  from public.profiles pr
  join public.subscription_plans p on p.id = pr.plan_id
  where pr.id = v_user_id;

  v_max_mb := coalesce(v_max_mb, 25);

  if p_file_size is null
     or p_file_size <= 0
     or p_file_size > v_max_mb::bigint * 1024 * 1024 then
    raise exception 'The file is empty or larger than the plan limit';
  end if;

  insert into public.uploaded_documents (
    id, user_id, file_name, storage_path, file_size, mime_type, status
  )
  values (
    v_id,
    v_user_id,
    v_file_name,
    v_user_id::text || '/' || v_id::text || '/original.pdf',
    p_file_size,
    'application/pdf',
    'uploaded'
  );

  return query
    select v_id, v_user_id::text || '/' || v_id::text || '/original.pdf', v_file_name;
end;
$$;

revoke all on function public.create_statement(text, bigint) from public, anon;
grant execute on function public.create_statement(text, bigint) to authenticated;

create or replace function public.delete_statement(p_document_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_path text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.uploaded_documents
  where id = p_document_id and user_id = v_user_id
  returning storage_path into v_path;

  if v_path is null then
    raise exception 'Document not found';
  end if;

  return v_path;
end;
$$;

revoke all on function public.delete_statement(uuid) from public, anon;
grant execute on function public.delete_statement(uuid) to authenticated;

-- Nothing in the application updates a statement row directly: the processor
-- uses service-role-only functions, and queue_conversion and
-- apply_transaction_changes are SECURITY DEFINER functions with their own
-- ownership checks.
drop policy if exists "Users can create their own documents" on public.uploaded_documents;
drop policy if exists "Users can update their own documents" on public.uploaded_documents;
drop policy if exists "Users can delete their own documents" on public.uploaded_documents;

revoke insert, update, delete on public.uploaded_documents from authenticated;
grant select on public.uploaded_documents to authenticated;

-- Defence in depth: even a service-role mistake cannot create a document row
-- whose storage path points into another user's folder. NOT VALID keeps the
-- migration safe for any legacy row while enforcing the rule on every new row.
alter table public.uploaded_documents
  add constraint uploaded_documents_owned_storage_path
  check (storage_path = user_id::text || '/' || id::text || '/original.pdf')
  not valid;

alter table public.extracted_transactions
  add constraint extracted_transactions_currency_format
  check (currency is null or currency ~ '^[A-Z]{3}$')
  not valid;

-- Superseded progress/failure helpers referenced the pre-rename table name.
drop function if exists public.update_statement_progress(uuid, text, integer);
drop function if exists public.mark_statement_failed(uuid, text);

-- ---------------------------------------------------------------------------
-- 2. Keep transaction rows inside their owner's document and job
-- ---------------------------------------------------------------------------

drop policy if exists "Users can create rows for their own documents"
  on public.extracted_transactions;
drop policy if exists "Users can update their own extracted transactions"
  on public.extracted_transactions;

create policy "Users can create rows for their own documents"
on public.extracted_transactions for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.uploaded_documents d
    where d.id = extracted_transactions.document_id
      and d.user_id = auth.uid()
  )
  and (
    job_id is null
    or exists (
      select 1
      from public.conversion_jobs j
      where j.id = extracted_transactions.job_id
        and j.document_id = extracted_transactions.document_id
        and j.user_id = auth.uid()
    )
  )
);

create policy "Users can update their own extracted transactions"
on public.extracted_transactions for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.uploaded_documents d
    where d.id = extracted_transactions.document_id
      and d.user_id = auth.uid()
  )
  and (
    job_id is null
    or exists (
      select 1
      from public.conversion_jobs j
      where j.id = extracted_transactions.job_id
        and j.document_id = extracted_transactions.document_id
        and j.user_id = auth.uid()
    )
  )
);

-- ---------------------------------------------------------------------------
-- 3. Usage: charge processing month, no refunds on delete
-- ---------------------------------------------------------------------------

alter table public.uploaded_documents
  add column if not exists pages_charged_period date;

create index if not exists uploaded_documents_user_charged_period_idx
  on public.uploaded_documents (user_id, pages_charged_period)
  where pages_charged_period is not null;

comment on column public.uploaded_documents.pages_charged_period is
  'Calendar month in which this document''s pages were charged to the allowance.';

update public.uploaded_documents
set pages_charged_period = date_trunc(
  'month',
  timezone('utc', coalesce(processed_at, updated_at, created_at))
)::date
where status in ('completed', 'partial')
  and pages_charged_period is null;

-- Rebuild the page counters from the documents that were actually charged.
update public.usage_records set pages_processed = 0;

insert into public.usage_records (user_id, period_start, pages_processed)
select
  user_id,
  pages_charged_period,
  sum(coalesce(page_count, 0))::integer
from public.uploaded_documents
where status in ('completed', 'partial')
  and pages_charged_period is not null
group by user_id, pages_charged_period
on conflict (user_id, period_start) do update
  set pages_processed = excluded.pages_processed,
      updated_at = now();

create or replace function public.track_document_insert_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', timezone('utc', new.created_at))::date;
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

create or replace function public.track_document_status_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', timezone('utc', now()))::date;
  v_was_counted boolean := old.status in ('completed', 'partial');
  v_is_counted boolean := new.status in ('completed', 'partial');
begin
  if new.status is distinct from old.status then
    if v_is_counted and not v_was_counted then
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
      new.pages_charged_period := v_period;
    elsif v_was_counted and not v_is_counted then
      update public.usage_records
      set pages_processed = greatest(0, pages_processed - coalesce(old.page_count, 0)),
          updated_at = now()
      where user_id = old.user_id
        and period_start = coalesce(
          old.pages_charged_period,
          date_trunc('month', timezone('utc', old.created_at))::date
        );
      new.pages_charged_period := null;
    end if;

    if new.status = 'failed' and old.status <> 'failed' then
      insert into public.usage_records (
        user_id, period_start, conversions_failed
      )
      values (new.user_id, v_period, 1)
      on conflict (user_id, period_start) do update
        set conversions_failed =
              public.usage_records.conversions_failed + 1,
            updated_at = now();
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
  v_period date := date_trunc('month', timezone('utc', old.created_at))::date;
begin
  -- Pages already processed are consumed. Deleting a statement must not
  -- restore the monthly allowance, otherwise a user could process unlimited
  -- pages by uploading and deleting the same document repeatedly.
  update public.usage_records
  set documents_uploaded = greatest(0, documents_uploaded - 1),
      storage_bytes = greatest(0, storage_bytes - old.file_size),
      updated_at = now()
  where user_id = old.user_id and period_start = v_period;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Atomic, allowance-aware extraction result save
-- ---------------------------------------------------------------------------

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
  v_job_status text;
  v_status text := coalesce(p_payload->>'status', 'failed');
  v_summary jsonb := coalesce(p_payload->'summary', '{}'::jsonb);
  v_validation jsonb := coalesce(p_payload->'validation', '{}'::jsonb);
  v_report jsonb := coalesce(p_payload->'report', '{}'::jsonb);
  v_page_count integer := coalesce((v_summary->>'page_count')::integer, 0);
  v_period date := date_trunc('month', timezone('utc', now()))::date;
  v_used integer := 0;
  v_page_limit integer;
  v_unlimited boolean := false;
  v_message text;
begin
  select user_id, status into v_user_id, v_job_status
  from public.conversion_jobs
  where id = p_job_id and document_id = p_document_id
  for update;

  if v_user_id is null then
    raise exception 'Conversion job not found';
  end if;

  if v_job_status not in ('queued', 'processing') then
    raise exception 'Conversion job is already finalised';
  end if;

  if v_status not in ('completed', 'partial', 'failed') then
    raise exception 'Invalid extraction status';
  end if;

  -- Replace semantics: a new attempt must never append to stale rows. If the
  -- allowance guard below rejects the statement, this also guarantees the
  -- failed document has no half-written ledger.
  delete from public.extracted_transactions where document_id = p_document_id;

  if v_status <> 'failed' then
    -- Lock the current month's usage row so two concurrent extractions cannot
    -- both pass the allowance check. Creating the row first also locks the
    -- first job for a user in a new month.
    insert into public.usage_records (user_id, period_start)
    values (v_user_id, v_period)
    on conflict (user_id, period_start) do nothing;

    select pages_processed into v_used
    from public.usage_records
    where user_id = v_user_id and period_start = v_period
    for update;

    select p.page_limit, p.unlimited into v_page_limit, v_unlimited
    from public.profiles pr
    join public.subscription_plans p on p.id = pr.plan_id
    where pr.id = v_user_id;

    v_page_limit := coalesce(v_page_limit, 3);
    v_unlimited := coalesce(v_unlimited, false);

    if not v_unlimited and (v_used + v_page_count) > v_page_limit then
      v_message := format(
        'This statement has %s pages, but only %s of %s pages remain on your monthly allowance. Upgrade your plan or upload a smaller statement.',
        v_page_count,
        greatest(0, v_page_limit - v_used),
        v_page_limit
      );

      update public.conversion_jobs
      set status = 'failed', error_message = v_message, finished_at = now()
      where id = p_job_id;

      update public.uploaded_documents
      set status = 'failed', error_message = v_message, processed_at = now()
      where id = p_document_id
        and status in ('uploaded', 'queued', 'processing');

      return;
    end if;
  end if;

  if v_status <> 'failed' then
    insert into public.extracted_transactions (
      document_id, job_id, user_id, txn_date, value_date, description,
      reference, debit, credit, balance, currency, page_number, sort_index,
      source, needs_review, review_reasons, raw_text
    )
    select
      p_document_id, p_job_id, v_user_id,
      nullif(r.txn_date, '')::date,
      nullif(r.value_date, '')::date,
      coalesce(r.description, ''),
      nullif(r.reference, ''),
      r.debit, r.credit, r.balance,
      nullif(r.currency, ''),
      r.page_number,
      coalesce(r.sort_index, 0),
      'extracted',
      coalesce(r.needs_review, false),
      coalesce(r.review_reasons, '[]'::jsonb),
      r.raw_text
    from jsonb_to_recordset(coalesce(p_payload->'transactions', '[]'::jsonb)) as r(
      txn_date text, value_date text, description text, reference text,
      debit numeric, credit numeric, balance numeric, currency text,
      page_number integer, sort_index integer, needs_review boolean,
      review_reasons jsonb, raw_text text
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
  where id = p_document_id
    and status in ('uploaded', 'queued', 'processing');
end;
$$;

revoke all on function public.save_extraction_result(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_extraction_result(uuid, uuid, jsonb)
  to service_role;

-- A late failure (for example after a timed-out HTTP acknowledgement) must not
-- destroy a completed result or release its pages.
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
  v_job_status text;
  v_message text := left(
    coalesce(nullif(btrim(p_message), ''), 'Processing failed.'),
    2000
  );
begin
  select document_id, status into v_document_id, v_job_status
  from public.conversion_jobs
  where id = p_job_id
  for update;

  if v_document_id is null or v_job_status not in ('queued', 'processing') then
    return;
  end if;

  update public.conversion_jobs
  set status = 'failed', error_message = v_message, finished_at = now()
  where id = p_job_id;

  update public.uploaded_documents
  set status = 'failed', error_message = v_message, processed_at = now()
  where id = v_document_id
    and status in ('uploaded', 'queued', 'processing');
end;
$$;

revoke all on function public.mark_conversion_failed(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_conversion_failed(uuid, text)
  to service_role;

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

  if v_job.status not in ('queued', 'processing') then
    return;
  end if;

  update public.conversion_jobs
  set status = 'failed', error_message = v_message, finished_at = now()
  where id = p_job_id;

  update public.uploaded_documents
  set status = 'failed', error_message = v_message, processed_at = now()
  where id = v_job.document_id
    and status in ('uploaded', 'queued', 'processing');
end;
$$;

revoke all on function public.fail_conversion(uuid, text) from public, anon;
grant execute on function public.fail_conversion(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Editor reconciliation must respect a derived opening balance
-- ---------------------------------------------------------------------------

create or replace function public.apply_transaction_changes(
  p_document_id uuid,
  p_upserts jsonb,
  p_deletes uuid[] default '{}'::uuid[]
)
returns setof public.extracted_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row jsonb;
  v_id uuid;
  v_next_sort integer;
  v_opening numeric(14, 2);
  v_closing numeric(14, 2);
  v_opening_source text;
  v_currency text;
  v_total_debits numeric(14, 2);
  v_total_credits numeric(14, 2);
  v_computed_closing numeric(14, 2);
  v_difference numeric(14, 2);
  v_transaction_count integer;
  v_needs_review_count integer;
  v_incomplete_rows integer;
  v_running_failures integer;
  v_duplicate_rows integer;
  v_mixed_currency_rows integer;
  v_has_balance boolean;
  v_validation_status text;
  v_checks jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    opening_balance,
    closing_balance,
    report->>'opening_balance_source',
    currency
  into v_opening, v_closing, v_opening_source, v_currency
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
  where document_id = p_document_id
    and user_id = v_user_id;

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

  select count(*)::integer
  into v_mixed_currency_rows
  from public.extracted_transactions
  where document_id = p_document_id
    and user_id = v_user_id
    and currency is not null
    and v_currency is not null
    and currency <> v_currency;

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
        when v_opening_source = 'derived'
          then to_char(v_opening, 'FM999,999,999,990.00') || ' (derived from the first running balance)'
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
      'label', 'Opening balance + credits - debits equals closing balance',
      'status', case
        when v_difference is null or v_opening_source = 'derived' then 'not_available'
        when abs(v_difference) < 0.005 then 'pass'
        else 'fail'
      end,
      'detail', case
        when v_opening_source = 'derived'
          then 'The opening balance was derived from the first running balance, so this is not an independent check.'
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
    ),
    jsonb_build_object(
      'id', 'currency_consistency',
      'label', 'All rows use the statement currency',
      'status', case when v_mixed_currency_rows = 0 then 'pass' else 'fail' end,
      'detail', case
        when v_mixed_currency_rows = 0 then 'Every row uses the statement currency.'
        else v_mixed_currency_rows || ' row(s) use a different currency; the summary totals mix currencies and were not treated as verified.'
      end
    )
  );

  if v_difference is null then
    v_validation_status := 'insufficient_data';
  elsif abs(v_difference) >= 0.005 or v_running_failures > 0 then
    v_validation_status := 'mismatch';
  elsif v_opening_source = 'derived' or v_mixed_currency_rows > 0 then
    v_validation_status := 'insufficient_data';
  else
    v_validation_status := 'verified';
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
      'duplicate_transactions', v_duplicate_rows,
      'mixed_currency_rows', v_mixed_currency_rows
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
