import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiContext, jsonError } from "@/lib/api";
import { PAID_PLAN_IDS, billingGrantsAccess } from "@/lib/billing";
import {
  getDodoClient,
  getDodoProductId,
  isCheckoutConfigured,
  siteUrl,
} from "@/lib/dodo";
import { logServerError } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  plan: z.enum(PAID_PLAN_IDS),
});

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 404
  );
}

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return jsonError("You must be signed in to subscribe.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The checkout request was invalid.");
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Choose a valid plan to continue.");
  }

  if (!isCheckoutConfigured()) {
    return jsonError(
      "Billing is not configured yet. Please try again later.",
      503
    );
  }

  const { user, supabase } = context;
  const { plan } = parsed.data;
  const productId = getDodoProductId(plan);
  if (!productId) {
    return jsonError("This plan is not available yet.", 503);
  }

  const { data: billing, error: billingError } = await supabase
    .from("billing_subscriptions")
    .select(
      "dodo_customer_id, plan_id, status, cancel_at_next_billing_date, current_period_end"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (billingError) {
    logServerError("Could not load subscription before checkout", billingError);
    return jsonError("Could not prepare checkout. Please try again.", 500);
  }

  const hasPaidAccess =
    billing &&
    billingGrantsAccess({
      planId: billing.plan_id,
      status: billing.status,
      cancelAtNextBillingDate: billing.cancel_at_next_billing_date,
      currentPeriodEnd: billing.current_period_end,
    });

  if (hasPaidAccess && billing.plan_id === plan) {
    return jsonError("You are already subscribed to this plan.", 409);
  }

  if (hasPaidAccess) {
    return jsonError(
      "You already have an active subscription. Use Manage subscription to change plans.",
      409
    );
  }

  if (!user.email) {
    return jsonError(
      "Your account needs an email address before you can subscribe.",
      400
    );
  }

  const baseUrl = siteUrl(request);
  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : undefined;

  try {
    const client = getDodoClient();

    // Create and link the Dodo customer before checkout. The webhook maps the
    // subscription back to this account through the customer id, so entitlement
    // never depends on optional checkout metadata being copied onto the
    // subscription.
    //
    // Customer ids are scoped to a Dodo environment. A row written in test mode
    // still holds a test customer id after switching to live (or the reverse),
    // and Dodo rejects a checkout that references it. Drop the id when it does
    // not exist in the active environment, then create a fresh customer.
    let customerId = billing?.dodo_customer_id ?? null;
    if (customerId) {
      try {
        await client.customers.retrieve(customerId);
      } catch (error) {
        if (isNotFoundError(error)) {
          customerId = null;
        } else {
          throw error;
        }
      }
    }

    if (!customerId) {
      const customer = await client.customers.create({
        email: user.email,
        name: displayName || user.email,
        metadata: { app_user_id: user.id },
      });
      customerId = customer.customer_id;

      const admin = createAdminClient();
      const { error: linkError } = await admin
        .from("billing_subscriptions")
        .upsert(
          { user_id: user.id, dodo_customer_id: customerId },
          { onConflict: "user_id" }
        );

      if (linkError) {
        logServerError("Could not link Dodo customer to account", linkError);
        return jsonError("Could not prepare checkout. Please try again.", 500);
      }
    }

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { customer_id: customerId },
      metadata: {
        app_user_id: user.id,
        plan,
      },
      return_url: `${baseUrl}/checkout/success?plan=${plan}`,
      cancel_url: `${baseUrl}/settings?checkout=cancelled`,
    });

    if (!session.checkout_url) {
      logServerError(
        "Dodo checkout session did not include a checkout URL",
        new Error("missing checkout_url")
      );
      return jsonError("Could not start checkout. Please try again.", 502);
    }

    return NextResponse.json(
      { url: session.checkout_url },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logServerError("Could not create Dodo checkout session", error);
    return jsonError("Could not start checkout. Please try again.", 502);
  }
}
