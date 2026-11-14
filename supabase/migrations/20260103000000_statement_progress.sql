-- Real processing progress: the processor records the current pipeline stage
-- and percentage while it works, and terminal states are finalised automatically.
-- These columns are additive and remain null for statements that never started.

alter table public.statements
  add column if not exists processing_stage text
    check (processing_stage is null or char_length(processing_stage) <= 160),
  add column if not exists progress_percent smallint
    check (progress_percent is null or progress_percent between 0 and 100);

comment on column public.statements.processing_stage is
  'Human-readable pipeline stage written by the processor while a job is running.';
comment on column public.statements.progress_percent is
  'Real completion percentage from the processor, from 0 to 100.';

-- Keep terminal rows honest and clear stale progress when a statement is
-- requeued for a retry.
create or replace function public.track_statement_progress()
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
    elsif new.status = 'failed' then
      new.processing_stage := 'Extraction failed';
      new.progress_percent := 100;
    elsif new.status = 'queued' then
      new.processing_stage := null;
      new.progress_percent := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists statements_track_progress on public.statements;
create trigger statements_track_progress
before update on public.statements
for each row execute function public.track_statement_progress();

-- Service-role-only progress updates. Once a statement reaches a terminal
-- state the function is a no-op, so late progress messages cannot overwrite it.
create or replace function public.update_statement_progress(
  p_statement_id uuid,
  p_stage text,
  p_percent integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_percent is null or p_percent < 0 or p_percent > 100 then
    raise exception 'Invalid progress percentage';
  end if;

  update public.statements
  set
    processing_stage = left(coalesce(nullif(btrim(p_stage), ''), 'Processing'), 160),
    progress_percent = p_percent,
    updated_at = now()
  where id = p_statement_id
    and status in ('queued', 'processing');
end;
$$;

revoke all on function public.update_statement_progress(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.update_statement_progress(uuid, text, integer)
  to service_role;
