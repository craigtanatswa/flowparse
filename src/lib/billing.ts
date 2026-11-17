/**
 * Pure billing rules shared by the server and the UI. This module deliberately
 * has no SDK or secret imports.
 */

export const PAID_PLAN_IDS = ["starter", "pro", "business"] as const;

export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export const BILLING_PLAN_LABELS: Record<PaidPlanId, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

export const BILLING_STATUS_LABELS: Record<string, string> = {
  none: "No subscription",
  pending: "Payment pending",
  active: "Active",
  past_due: "Payment due",
  on_hold: "On hold",
  paused: "Paused",
  cancelled: "Cancelled",
  failed: "Failed",
  expired: "Expired",
};

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return (
    typeof value === "string" &&
    (PAID_PLAN_IDS as readonly string[]).includes(value)
  );
}

export function billingStatusLabel(status: string | null | undefined): string {
  if (!status) return BILLING_STATUS_LABELS.none;
  return BILLING_STATUS_LABELS[status] ?? status;
}

/** Statuses that keep a paying customer's entitlement. */
export function isEntitledStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "past_due";
}

/**
 * Whether the stored subscription still grants its paid plan. This includes a
 * subscription cancelled at the next billing date until that date passes.
 */
export function billingGrantsAccess(input: {
  planId: string | null | undefined;
  status: string | null | undefined;
  cancelAtNextBillingDate?: boolean | null;
  currentPeriodEnd?: string | null;
  now?: Date;
}): boolean {
  if (!isPaidPlanId(input.planId)) return false;
  return (
    resolveEntitledPlan({
      paidPlan: input.planId,
      status: input.status ?? null,
      cancelAtNextBillingDate: input.cancelAtNextBillingDate,
      currentPeriodEnd: input.currentPeriodEnd,
      now: input.now,
    }) !== "free"
  );
}

/**
 * Map the authoritative Dodo subscription state to the plan that should be
 * granted. A subscription cancelled at the next billing date keeps access
 * until that date; every other terminal/unpaid state falls back to Free.
 */
export function resolveEntitledPlan(input: {
  paidPlan: PaidPlanId | null;
  status: string | null;
  cancelAtNextBillingDate?: boolean | null;
  currentPeriodEnd?: string | null;
  now?: Date;
}): PaidPlanId | "free" {
  if (!input.paidPlan) return "free";
  if (isEntitledStatus(input.status)) return input.paidPlan;

  if (input.status === "cancelled" && input.cancelAtNextBillingDate) {
    const end = input.currentPeriodEnd
      ? new Date(input.currentPeriodEnd).getTime()
      : Number.NaN;
    if (Number.isFinite(end) && end > (input.now ?? new Date()).getTime()) {
      return input.paidPlan;
    }
  }

  return "free";
}
