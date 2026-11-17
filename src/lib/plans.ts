import type { Tables } from "@/lib/database.types";
import { MAX_FILE_MB } from "@/lib/constants";

export type PlanRecord = Tables<"subscription_plans">;

/**
 * Marketing copy and the fallback used when the plan catalogue cannot be read.
 * Server components should prefer the database-backed plan from `account.ts`.
 */
export const FREE_PLAN = {
  id: "free",
  name: "Free",
  price: "$0",
  cadence: "forever",
  pageLimit: 3,
  unlimited: false,
  batchLimit: 1,
  fileSizeMb: MAX_FILE_MB,
  description:
    "Get started with basic statement conversion and export, with a small monthly page allowance.",
  features: [
    "3 processed pages per month",
    "PDF bank statement uploads",
    "Excel and CSV exports",
    "Basic transaction extraction",
  ],
} as const;

export interface AccountPlan {
  id: string;
  name: string;
  description: string;
  priceDisplay: string;
  cadence: string;
  /** Processed pages allowed per calendar month; null when unlimited. */
  pageLimit: number | null;
  unlimited: boolean;
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
  pageLimit: FREE_PLAN.pageLimit,
  unlimited: FREE_PLAN.unlimited,
  batchLimit: FREE_PLAN.batchLimit,
  fileSizeMb: FREE_PLAN.fileSizeMb,
  features: [...FREE_PLAN.features],
};

/**
 * Display data for the plans FlowParse sells. Prices and page allowances must
 * match the Dodo products configured through `DODO_PRODUCT_*_TEST/LIVE`.
 */
export const MARKETING_PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    pageAllowance: "3 pages / month",
    description: "Try FlowParse with a small monthly page allowance.",
    features: [
      "3 processed pages per month",
      "PDF bank statement uploads",
      "Excel and CSV exports",
      "Basic transaction extraction",
    ],
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "$9",
    cadence: "month",
    pageAllowance: "100 pages / month",
    description: "For individuals converting statements regularly.",
    features: [
      "100 pages per month",
      "Multiple document uploads",
      "Conversion history",
      "Full export functionality",
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    cadence: "month",
    pageAllowance: "400 pages / month",
    description: "For busy professionals who need more volume and control.",
    features: [
      "400 pages per month",
      "Bulk processing",
      "Priority processing",
      "Advanced reconciliation",
    ],
    highlight: true,
  },
  {
    id: "business",
    name: "Business",
    price: "$39",
    cadence: "month",
    pageAllowance: "Unlimited pages",
    description: "For finance teams processing statements at scale.",
    features: [
      "Unlimited pages per month",
      "Higher-volume processing",
      "Bulk exports",
      "Extended conversion history",
    ],
    highlight: false,
  },
] as const;

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
    pageLimit: record.page_limit,
    unlimited: record.unlimited,
    batchLimit: record.batch_limit,
    fileSizeMb: record.file_size_mb,
    features: Array.isArray(record.features)
      ? record.features.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function pageAllowanceLabel(plan: AccountPlan): string {
  return plan.unlimited ? "Unlimited pages" : `${plan.pageLimit ?? 0} pages`;
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
  pagesProcessed: number,
  plan: AccountPlan = FALLBACK_ACCOUNT_PLAN
): boolean {
  if (plan.unlimited) return false;
  return pagesProcessed >= (plan.pageLimit ?? 0);
}

export function planFileSizeBytes(plan: AccountPlan): number {
  return plan.fileSizeMb * 1024 * 1024;
}
