-- Paid plan page allowances: Starter 100, Pro 1,000, Business 10,000 pages
-- per calendar month. Business is no longer an unlimited plan; it has a finite
-- 10,000-page cap so the same save-time allowance guard applies to every paid
-- tier.
--
-- Existing subscriptions keep their plan id and immediately receive the new
-- allowance. The Free plan remains at 3 pages per month.

update public.subscription_plans
set page_limit = 100,
    unlimited = false,
    updated_at = now()
where id = 'starter';

update public.subscription_plans
set page_limit = 1000,
    unlimited = false,
    description = 'For busy professionals who need more volume and control.',
    features = jsonb_build_array(
      '1,000 pages per month',
      'Bulk processing',
      'Priority processing',
      'Advanced reconciliation'
    ),
    updated_at = now()
where id = 'pro';

update public.subscription_plans
set page_limit = 10000,
    unlimited = false,
    description = 'For finance teams processing statements at scale.',
    features = jsonb_build_array(
      '10,000 pages per month',
      'Higher-volume processing',
      'Bulk exports',
      'Extended conversion history'
    ),
    updated_at = now()
where id = 'business';
