import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { logServerError } from "@/lib/log";
import {
  FALLBACK_ACCOUNT_PLAN,
  accountPlanFromRecord,
  currentMonthStartDate,
  type AccountPlan,
} from "@/lib/plans";

export interface AccountProfile {
  display_name: string;
  company: string | null;
  plan_id: string;
}

export interface AccountUsage {
  documents_uploaded: number;
  conversions_completed: number;
  conversions_failed: number;
  pages_processed: number;
  storage_bytes: number;
}

export interface AccountBilling {
  plan_id: string;
  status: string;
  cancel_at_next_billing_date: boolean;
  current_period_end: string | null;
  dodo_customer_id: string | null;
}

export interface AccountData {
  plan: AccountPlan;
  profile: AccountProfile | null;
  usage: AccountUsage;
  usageAvailable: boolean;
  billing: AccountBilling | null;
}

const EMPTY_USAGE: AccountUsage = {
  documents_uploaded: 0,
  conversions_completed: 0,
  conversions_failed: 0,
  pages_processed: 0,
  storage_bytes: 0,
};

/**
 * Load the signed-in user's profile, subscription plan and current-month usage.
 * Every query is owner-scoped by RLS; the plan catalogue is public read-only.
 */
export async function loadAccountData(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AccountData> {
  const [profileResult, usageResult, billingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, company, plan_id")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("usage_records")
      .select(
        "documents_uploaded, conversions_completed, conversions_failed, pages_processed, storage_bytes"
      )
      .eq("user_id", userId)
      .eq("period_start", currentMonthStartDate())
      .maybeSingle(),
    supabase
      .from("billing_subscriptions")
      .select(
        "plan_id, status, cancel_at_next_billing_date, current_period_end, dodo_customer_id"
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    logServerError("Could not load account profile", profileResult.error);
  }
  if (usageResult.error) {
    logServerError("Could not load account usage", usageResult.error);
  }
  if (billingResult.error) {
    logServerError("Could not load billing subscription", billingResult.error);
  }

  let plan = FALLBACK_ACCOUNT_PLAN;
  if (profileResult.data?.plan_id) {
    const { data: planRow, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", profileResult.data.plan_id)
      .maybeSingle();

    if (planError) {
      logServerError("Could not load subscription plan", planError);
    } else {
      plan = accountPlanFromRecord(planRow);
    }
  }

  return {
    plan,
    profile: profileResult.data ?? null,
    usage: usageResult.data ?? EMPTY_USAGE,
    usageAvailable: !usageResult.error,
    billing: billingResult.data ?? null,
  };
}

/** Active plans in display order, sourced from the database catalogue. */
export async function loadActivePlans(
  supabase: SupabaseClient<Database>
): Promise<AccountPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    logServerError("Could not load plan catalogue", error);
    return [];
  }

  return (data ?? []).map(accountPlanFromRecord);
}
