import type { Tables } from "@/lib/database.types";
import { MAX_FILES_PER_UPLOAD, MAX_FILE_MB } from "@/lib/constants";

export type PlanRecord = Tables<"subscription_plans">;

/**
 * Marketing copy and the fallback used when the plan catalogue cannot be read.
 * Server components should prefer the database-backed plan from `account.ts`.
 */
export const FREE_PLAN = {
  id: "free",
  name: "Free",
  price: "£0",
  cadence: "forever",
  statementLimit: 25,
  batchLimit: MAX_FILES_PER_UPLOAD,
  fileSizeMb: MAX_FILE_MB,
  description:
    "Everything you need to convert and review statements, with a monthly statement allowance.",
} as const;

export interface AccountPlan {
  id: string;
  name: string;
  description: string;
  priceDisplay: string;
  cadence: string;
  statementLimit: number;
  batchLimit: number;
  fileSizeMb: number;
  features: string[];
}

export const FALLBACK_ACCOUNT_PLAN: AccountPlan = {
  id: FREE_PLAN.id,
  name: FREE_PLAN.name,
  description: FREE_PLAN.description,
  priceDisplay: FREE_PLAN.price,
  cadence: FREE_PLAN.cadence,
  statementLimit: FREE_PLAN.statementLimit,
  batchLimit: FREE_PLAN.batchLimit,
  fileSizeMb: FREE_PLAN.fileSizeMb,
  features: [],
};

export function accountPlanFromRecord(
  record: PlanRecord | null | undefined
): AccountPlan {
  if (!record) return FALLBACK_ACCOUNT_PLAN;

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    priceDisplay: record.price_display,
    cadence: record.cadence,
    statementLimit: record.statement_limit,
    batchLimit: record.batch_limit,
    fileSizeMb: record.file_size_mb,
    features: Array.isArray(record.features)
      ? record.features.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function currentMonthStartIso(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  ).toISOString();
}

/** The `date` value used by `usage_records.period_start`. */
export function currentMonthStartDate(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function nextAllowanceReset(now = new Date()): string {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(next);
}

export function planLimitReached(
  monthlyStatements: number,
  limit: number = FREE_PLAN.statementLimit
): boolean {
  return monthlyStatements >= limit;
}

export function planFileSizeBytes(plan: AccountPlan): number {
  return plan.fileSizeMb * 1024 * 1024;
}
