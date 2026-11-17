import { NextResponse } from "next/server";

import { getApiContext, jsonError } from "@/lib/api";
import { getDodoClient, siteUrl } from "@/lib/dodo";
import { logServerError } from "@/lib/log";

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return jsonError("You must be signed in.", 401);

  const { user, supabase } = context;
  const { data: billing, error } = await supabase
    .from("billing_subscriptions")
    .select("dodo_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logServerError("Could not load billing customer", error);
    return jsonError("Could not open the billing portal. Please try again.", 500);
  }

  if (!billing?.dodo_customer_id) {
    return jsonError(
      "No billing account is linked to this user yet. Start a subscription first.",
      409
    );
  }

  try {
    const client = getDodoClient();
    const session = await client.customers.customerPortal.create(
      billing.dodo_customer_id,
      { return_url: `${siteUrl(request)}/settings` }
    );

    return NextResponse.json(
      { url: session.link },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logServerError("Could not create Dodo customer portal session", error);
    return jsonError("Could not open the billing portal. Please try again.", 502);
  }
}
