import { NextResponse } from "next/server";

import { syncSubscriptionFromDodo } from "@/lib/billing-sync";
import {
  getDodoClient,
  isWebhookConfigured,
} from "@/lib/dodo";
import { logServerError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.active",
  "subscription.renewed",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.failed",
  "subscription.on_hold",
  "subscription.past_due",
  "subscription.paused",
  "subscription.unpaused",
  "subscription.updated",
  "subscription.plan_changed",
  "subscription.update_payment_method",
]);

interface WebhookSubscriptionData {
  subscription_id?: string;
  product_id?: string;
  metadata?: Record<string, string> | null;
  customer?: { customer_id?: string };
}

interface WebhookEnvelope {
  type: string;
  timestamp?: string;
  data?: WebhookSubscriptionData;
}

export async function POST(request: Request) {
  if (!isWebhookConfigured()) {
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event: WebhookEnvelope;
  try {
    const client = getDodoClient();
    event = client.webhooks.unwrap(rawBody, { headers }) as WebhookEnvelope;
  } catch (error) {
    // A bad signature means the request is not from Dodo. Do not log the body.
    logServerError("Rejected Dodo webhook with an invalid signature", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (!SUBSCRIPTION_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const subscriptionId = event.data?.subscription_id;
  if (!subscriptionId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const result = await syncSubscriptionFromDodo({
      webhookId: request.headers.get("webhook-id"),
      eventType: event.type,
      subscriptionId,
      metadata: event.data?.metadata ?? null,
      customerId: event.data?.customer?.customer_id ?? null,
      productId: event.data?.product_id ?? null,
      eventAt: event.timestamp ?? null,
    });

    return NextResponse.json({
      received: true,
      applied: result.applied,
    });
  } catch (error) {
    // A 5xx tells Dodo to retry. The event is idempotent once it succeeds.
    logServerError("Could not process Dodo webhook", error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}
