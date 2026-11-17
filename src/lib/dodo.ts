import "server-only";

import DodoPayments from "dodopayments";

import { PAID_PLAN_IDS, type PaidPlanId } from "@/lib/billing";

export type DodoEnvironment = "test_mode" | "live_mode";

/**
 * Dodo test mode is the safe default. A missing or malformed environment value
 * must never select live mode.
 */
export function dodoEnvironment(): DodoEnvironment {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "live_mode"
    : "test_mode";
}

function productEnvName(plan: PaidPlanId): string {
  return `DODO_PRODUCT_${plan.toUpperCase()}_${
    dodoEnvironment() === "live_mode" ? "LIVE" : "TEST"
  }`;
}

export function getDodoProductId(plan: PaidPlanId): string | null {
  const value = process.env[productEnvName(plan)]?.trim();
  if (!value || !value.startsWith("pdt_")) return null;
  return value;
}

export function getPlanForProductId(productId: string): PaidPlanId | null {
  for (const plan of PAID_PLAN_IDS) {
    if (getDodoProductId(plan) === productId) return plan;
  }
  return null;
}

export function isCheckoutConfigured(): boolean {
  return Boolean(
    process.env.DODO_PAYMENTS_API_KEY?.trim() &&
      PAID_PLAN_IDS.every((plan) => getDodoProductId(plan))
  );
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim());
}

let client: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (client) return client;

  const bearerToken = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!bearerToken) {
    throw new Error("DODO_PAYMENTS_API_KEY is not configured.");
  }

  client = new DodoPayments({
    bearerToken,
    environment: dodoEnvironment(),
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() || undefined,
  });

  return client;
}

export function siteUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}
