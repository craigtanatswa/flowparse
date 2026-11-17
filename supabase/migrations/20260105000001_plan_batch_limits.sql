-- FlowParse upload batch limits per plan.
--
-- The UI caps a batch at MAX_FILES_PER_UPLOAD (10). Keep the catalogue aligned
-- so no plan advertises more files than the uploader accepts.

update public.subscription_plans
set batch_limit = case id
    when 'free' then 1
    when 'starter' then 5
    when 'pro' then 10
    when 'business' then 10
    else batch_limit
  end,
  updated_at = now()
where id in ('free', 'starter', 'pro', 'business');
