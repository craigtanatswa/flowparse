import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, CreditCard } from "lucide-react";

import { BillingConfirmation } from "@/components/app/billing-confirmation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadAccountData } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { billingGrantsAccess, isPaidPlanId } from "@/lib/billing";
import { pageAllowanceLabel } from "@/lib/plans";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { plan: requestedPlan } = await searchParams;
  const account = await loadAccountData(supabase, user.id);

  const confirmed =
    isPaidPlanId(account.plan.id) &&
    Boolean(
      account.billing &&
        billingGrantsAccess({
          planId: account.billing.plan_id,
          status: account.billing.status,
          cancelAtNextBillingDate: account.billing.cancel_at_next_billing_date,
          currentPeriodEnd: account.billing.current_period_end,
        })
    ) &&
    (!requestedPlan ||
      (isPaidPlanId(requestedPlan) && requestedPlan === account.plan.id));

  return (
    <>
      <BillingConfirmation confirmed={confirmed} />
      <div className="mx-auto flex w-full max-w-xl flex-col items-center py-10 text-center sm:py-16">
        <span
          className={`flex size-14 items-center justify-center rounded-2xl ${
            confirmed ? "bg-accent text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {confirmed ? (
            <CheckCircle2 className="size-7" />
          ) : (
            <Clock3 className="size-7" />
          )}
        </span>

        <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-[-0.035em]">
          {confirmed ? "Your subscription is active" : "Confirming your payment"}
        </h1>

        <p className="mt-3 max-w-md text-[13px] leading-6 text-muted-foreground">
          {confirmed
            ? `You're on the ${account.plan.name} plan. Your monthly allowance is ${pageAllowanceLabel(
                account.plan
              ).toLowerCase()}.`
            : "Dodo Payments is confirming your payment. Access is activated automatically once the secure webhook reaches FlowParse — this usually takes a few seconds."}
        </p>

        {confirmed ? (
          <div className="mt-7 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/dashboard#upload">
                Upload a statement
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/settings">Manage subscription</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-7 w-full">
            <Card className="bg-white">
              <CardContent className="flex items-center gap-3 p-4 text-left">
                <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                <p className="text-[11.5px] leading-5 text-muted-foreground">
                  You can safely close this page. Your plan updates in Settings as
                  soon as Dodo confirms the payment. You will not be charged twice.
                </p>
              </CardContent>
            </Card>
            <Button asChild variant="ghost" size="sm" className="mt-3">
              <Link href="/settings">View subscription status</Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
