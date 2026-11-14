-- The inline editor needs the saved rows back (including server-generated ids),
-- and the reconciliation shown to the user must reflect their saved changes.

drop function if exists public.apply_transaction_changes(uuid, jsonb, uuid[]);

create or replace function public.apply_transaction_changes(
  p_statement_id uuid,
  p_upserts jsonb,
  p_deletes uuid[] default '{}'::uuid[]
)
returns setof public.transactions
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
  v_has_balance boolean;
  v_validation_status text;
  v_checks jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select opening_balance, closing_balance
  into v_opening, v_closing
  from public.statements
  where id = p_statement_id and user_id = v_user_id;

  if not found then
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
  end loop;

  -- Recalculate the reconciliation from the current saved ledger. This keeps
  -- the panel honest after user edits rather than showing the extraction-time
  -- totals forever.
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
  from public.transactions
  where statement_id = p_statement_id
    and user_id = v_user_id;

  select count(*)::integer
  into v_running_failures
  from (
    select
      balance,
      coalesce(credit, 0) - coalesce(debit, 0) as net_change,
      lag(balance) over (order by sort_index, created_at) as previous_balance
    from public.transactions
    where statement_id = p_statement_id
      and user_id = v_user_id
  ) running
  where balance is not null
    and previous_balance is not null
    and abs(balance - (previous_balance + net_change)) > 0.005;

  select exists (
    select 1
    from public.transactions
    where statement_id = p_statement_id
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
    )
  );

  if v_difference is null then
    v_validation_status := 'insufficient_data';
  elsif abs(v_difference) < 0.005 and v_running_failures = 0 then
    v_validation_status := 'verified';
  else
    v_validation_status := 'mismatch';
  end if;

  update public.statements
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
      'incomplete_rows', v_incomplete_rows
    ),
    validation_status = v_validation_status,
    updated_at = now()
  where id = p_statement_id
    and user_id = v_user_id;

  return query
    select *
    from public.transactions
    where statement_id = p_statement_id
      and user_id = v_user_id
    order by sort_index, created_at;
end;
$$;

revoke all on function public.apply_transaction_changes(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.apply_transaction_changes(uuid, jsonb, uuid[]) to authenticated;
