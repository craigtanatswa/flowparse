import "server-only";

import { createHash } from "node:crypto";

import {
  isEntitledStatus,
  resolveEntitledPlan,
  type PaidPlanId,
} from "@/lib/billing";
import { getDodoClient, getPlanForProductId } from "@/lib/dodo";
import { logServerError } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/utils";

interface DodoSubscription {
  subscription_id: string;
  product_id: string;
  status: string;
  customer: { customer_id: string };
  metadata: Record<string, string> | null;
  cancel_at_next_billing_date: boolean;
  next_billing_date: string;
}

export interface SubscriptionSyncInput {
  /** The Dodo `webhook-id`; the idempotency key for this delivery. */
  webhookId: string | null;
  eventType: string;
  subscriptionId: string;
  /** Metadata copied from the checkout session, used to map the app user. */
  metadata?: Record<string, string> | null;
  /** Customer id from the event, used when metadata is absent. */
  customerId?: string | null;
  /** Product id from the event, used to identify the plan. */
  productId?: string | null;
  /** Top-level webhook timestamp. */
  eventAt?: string | null;
}

export interface SubscriptionSyncResult {
  applied: boolean;
  userId: string | null;
  plan: PaidPlanId | "free" | null;
}

function idempotencyKey(input: SubscriptionSyncInput): string {
  if (input.webhookId?.trim()) return input.webhookId.trim();
  return createHash("sha256")
    .update(
      [
        input.eventType,
        input.subscriptionId,
        input.eventAt ?? "",
        input.productId ?? "",
      ].join(":")
    )
    .digest("hex");
}

function metadataUserId(
  metadata: Record<string, string> | null | undefined
): string | null {
  const value = metadata?.app_user_id;
  return typeof value === "string" && isUuid(value) ? value : null;
}

async function lookupUserId(input: {
  metadata?: Record<string, string> | null;
  customerId?: string | null;
}): Promise<string | null> {
  const fromMetadata = metadataUserId(input.metadata);
  if (fromMetadata) return fromMetadata;

  if (!input.customerId) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("user_id")
    .eq("dodo_customer_id", input.customerId)
    .maybeSingle();

  if (error) {
    logServerError("Could not resolve billing customer", error);
    return null;
  }

  return data?.user_id ?? null;
}

/**
 * Re-read a subscription from Dodo, resolve the entitled plan, and apply it
 * through the idempotent database RPC. The webhook payload is only a trigger:
 * entitlement always comes from the signed webhook plus the authoritative
 * subscription record.
 */
export async function syncSubscriptionFromDodo(
  input: SubscriptionSyncInput
): Promise<SubscriptionSyncResult> {
  const client = getDodoClient();
  const webhookId = idempotencyKey(input);

  let subscription: DodoSubscription;
  try {
    subscription = (await client.subscriptions.retrieve(
      input.subscriptionId
    )) as unknown as DodoSubscription;
  } catch (error) {
    logServerError("Could not retrieve Dodo subscription", error);
    throw error;
  }

  const userId =
    (await lookupUserId({
      metadata: subscription.metadata ?? input.metadata,
      customerId: subscription.customer?.customer_id ?? input.customerId,
    })) ?? null;

  if (!userId) {
    // Without a verified mapping there is no entitlement to change. Do not
    // guess: acknowledge the event so Dodo stops retrying.
    logServerError(
      "Dodo subscription could not be mapped to an app user",
      new Error(`subscription ${subscription.subscription_id}`)
    );
    return { applied: false, userId: null, plan: null };
  }

  const paidPlan =
    getPlanForProductId(subscription.product_id) ??
    (input.productId ? getPlanForProductId(input.productId) : null);

  if (!paidPlan) {
    logServerError(
      "Dodo subscription references an unconfigured product",
      new Error(subscription.product_id)
    );
    return { applied: false, userId, plan: null };
  }

  const entitledPlan = resolveEntitledPlan({
    paidPlan,
    status: subscription.status,
    cancelAtNextBillingDate: subscription.cancel_at_next_billing_date,
    currentPeriodEnd: subscription.next_billing_date,
  });

  const admin = createAdminClient();

  // A user can have several Dodo subscriptions over time (for example after
  // cancelling and subscribing again). Delayed events for a superseded
  // subscription must not replace the one that currently grants access. The
  // `apply_billing_event` migration enforces the same rule inside Postgres; this
  // check keeps the behaviour correct even before that migration is applied.
  const { data: stored, error: storedError } = await admin
    .from("billing_subscriptions")
    .select("dodo_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (storedError) {
    logServerError(
      "Could not load stored subscription before applying event",
      storedError
    );
    throw storedError;
  }

  if (
    stored?.dodo_subscription_id &&
    stored.dodo_subscription_id !== subscription.subscription_id &&
    isEntitledStatus(stored.status)
  ) {
    return { applied: false, userId, plan: entitledPlan };
  }

  const { data, error } = await admin.rpc("apply_billing_event", {
    p_webhook_id: webhookId,
    p_event_type: input.eventType,
    p_user_id: userId,
    p_customer_id: subscription.customer?.customer_id ?? input.customerId ?? null,
    p_subscription_id: subscription.subscription_id,
    p_product_id: subscription.product_id ?? input.productId ?? null,
    p_plan_id: entitledPlan,
    p_status: subscription.status,
    p_cancel_at_next_billing_date:
      subscription.cancel_at_next_billing_date ?? false,
    p_current_period_end: subscription.next_billing_date ?? null,
    p_event_at: input.eventAt ?? new Date().toISOString(),
  });

  if (error) {
    logServerError("Could not apply billing event", error);
    throw error;
  }

  return { applied: Boolean(data), userId, plan: entitledPlan };
}
