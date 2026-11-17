"use client";

import * as React from "react";
import { ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { PaidPlanId } from "@/lib/billing";
import { cn } from "@/lib/utils";

async function postJson(url: string, body?: unknown): Promise<string | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  let payload: { url?: string; error?: string } | null = null;
  try {
    payload = (await response.json()) as { url?: string; error?: string };
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.url) {
    toast.error(payload?.error || "Something went wrong. Please try again.");
    return null;
  }

  return payload.url;
}

export function CheckoutButton({
  plan,
  label,
  className,
}: {
  plan: PaidPlanId;
  label: string;
  className?: string;
}) {
  const [loading, setLoading] = React.useState(false);

  async function startCheckout() {
    if (loading) return;
    setLoading(true);
    try {
      const url = await postJson("/api/billing/checkout", { plan });
      if (url) window.location.assign(url);
    } catch {
      toast.error("Could not start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      className={cn("w-full", className)}
      onClick={startCheckout}
      disabled={loading}
    >
      {loading ? <Loader2 className="animate-spin" /> : null}
      {label}
      {!loading ? <ArrowRight /> : null}
    </Button>
  );
}

export function ManageBillingButton({
  className,
  variant = "outline",
  label = "Manage subscription",
}: {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  label?: string;
}) {
  const [loading, setLoading] = React.useState(false);

  async function openPortal() {
    if (loading) return;
    setLoading(true);
    try {
      const url = await postJson("/api/billing/portal");
      if (url) window.location.assign(url);
    } catch {
      toast.error("Could not open the billing portal. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={cn("w-full", className)}
      onClick={openPortal}
      disabled={loading}
    >
      {loading ? <Loader2 className="animate-spin" /> : <ExternalLink />}
      {label}
    </Button>
  );
}
