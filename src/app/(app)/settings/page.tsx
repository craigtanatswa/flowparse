import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  FileText,
  Gauge,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import {
  CheckoutButton,
  ManageBillingButton,
} from "@/components/app/billing-actions";
import { ProfileForm } from "@/components/app/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAccountData, loadActivePlans } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import {
  billingGrantsAccess,
  billingStatusLabel,
  isPaidPlanId,
} from "@/lib/billing";
import { logServerError } from "@/lib/log";
import {
  nextAllowanceReset,
  pageAllowanceLabel,
} from "@/lib/plans";
import {
  cn,
  formatDate,
  formatFileSize,
  pluralize,
} from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

function formatMemberSince(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { user, supabase } = await requireUser();
  const { checkout } = await searchParams;

  const [account, plans, totalResult, transactionResult] = await Promise.all([
    loadAccountData(supabase, user.id),
    loadActivePlans(supabase),
    supabase.from("uploaded_documents").select("id", { count: "exact", head: true }),
    supabase
      .from("extracted_transactions")
      .select("id", { count: "exact", head: true }),
  ]);

  for (const result of [totalResult, transactionResult]) {
    if (result.error) {
      logServerError("Could not load account usage", result.error);
    }
  }

  const { plan, usage, billing } = account;
  const totalStatements = totalResult.count ?? 0;
  const monthPages = usage.pages_processed;
  const monthStatements = usage.documents_uploaded;
  const transactionCount = transactionResult.count ?? 0;
  const usagePercent = plan.unlimited
    ? 0
    : Math.min(
        100,
        Math.round((monthPages / (plan.pageLimit ?? 1)) * 100)
      );
  const subscriptionStatus = billing ? billingStatusLabel(billing.status) : "No subscription";
  const hasPaidAccess = billing
    ? billingGrantsAccess({
        planId: billing.plan_id,
        status: billing.status,
        cancelAtNextBillingDate: billing.cancel_at_next_billing_date,
        currentPeriodEnd: billing.current_period_end,
      })
    : false;
  const canManage = Boolean(billing?.dodo_customer_id);
  const cancelling =
    hasPaidAccess &&
    billing?.cancel_at_next_billing_date &&
    billing.current_period_end
      ? formatDate(billing.current_period_end)
      : null;
  const renewsOn =
    !cancelling && billing?.current_period_end
      ? formatDate(billing.current_period_end)
      : null;

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";
  const displayName =
    account.profile?.display_name?.trim() ||
    metadataName ||
    user.email?.split("@")[0]?.replace(/[._-]+/g, " ") ||
    "Your account";

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, review your plan, and keep track of your monthly usage."
      />

      {checkout === "cancelled" ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-900">
          <CreditCard className="mt-0.5 size-4 shrink-0" />
          <p>
            Checkout was cancelled and you have not been charged. You can choose a
            plan again whenever you are ready.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
                  <UserRound className="size-4" />
                </span>
                <div>
                  <CardTitle>Profile</CardTitle>
                  <p className="text-[11.5px] text-muted-foreground">
                    Your account details and display name.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3.5 rounded-xl border border-border bg-muted/25 p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-semibold text-primary ring-1 ring-border">
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium capitalize text-foreground">
                    {displayName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Mail className="size-3" />
                    <span className="truncate">{user.email}</span>
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <ProfileForm initialName={account.profile?.display_name ?? ""} />
              </div>

              <dl className="mt-5 grid gap-3 border-t border-border/70 pt-5 text-[11.5px] sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Email address</dt>
                  <dd className="mt-0.5 break-all font-medium text-foreground">
                    {user.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {formatMemberSince(user.created_at)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
                  <LockKeyhole className="size-4" />
                </span>
                <div>
                  <CardTitle>Security</CardTitle>
                  <p className="text-[11.5px] text-muted-foreground">
                    Password and document protection.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[12.5px] font-medium text-foreground">
                      Password
                    </p>
                    <p className="mt-0.5 max-w-md text-[11.5px] leading-5 text-muted-foreground">
                      Send yourself a secure link to choose a new password.
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/forgot-password">Change password</Link>
                </Button>
              </div>

              <div className="mt-4 flex gap-3 border-t border-border/70 pt-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-[12.5px] font-medium text-foreground">
                    Private document storage
                  </p>
                  <p className="mt-0.5 max-w-lg text-[11.5px] leading-5 text-muted-foreground">
                    Statements are scoped to your account with per-user database
                    rules. PDFs and exports are only served after an ownership check.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
                    <CreditCard className="size-4" />
                  </span>
                  <div>
                    <p className="text-[10.5px] font-medium tracking-[0.01em] text-muted-foreground">
                      Subscription
                    </p>
                    <p className="text-[14px] font-semibold text-foreground">
                      {plan.name} plan
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                    hasPaidAccess
                      ? "bg-accent text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {subscriptionStatus}
                </span>
              </div>

              <div className="mt-5 flex items-end gap-1.5">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.04em]">
                  {plan.priceDisplay}
                </span>
                <span className="pb-0.5 text-[11.5px] text-muted-foreground">
                  / {plan.cadence}
                </span>
              </div>
              <p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">
                {plan.description}
              </p>

              <ul className="mt-4 space-y-2 border-t border-border/70 pt-4 text-[11.5px] text-foreground/75">
                <li className="flex items-center justify-between gap-3">
                  <span>Pages per month</span>
                  <span className="font-medium text-foreground">
                    {plan.unlimited ? "Unlimited" : pageAllowanceLabel(plan)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Maximum PDF size</span>
                  <span className="font-medium text-foreground">
                    {plan.fileSizeMb} MB
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Files per batch</span>
                  <span className="font-medium text-foreground">
                    {plan.batchLimit}
                  </span>
                </li>
                {cancelling ? (
                  <li className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                    <span>Access ends</span>
                    <span className="font-medium text-foreground">{cancelling}</span>
                  </li>
                ) : renewsOn && hasPaidAccess ? (
                  <li className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                    <span>Renews</span>
                    <span className="font-medium text-foreground">{renewsOn}</span>
                  </li>
                ) : null}
              </ul>

              {billing?.status === "past_due" ? (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">
                  Your last payment did not go through. Update your payment method
                  to avoid losing access.
                </p>
              ) : null}

              {billing &&
              !hasPaidAccess &&
              billing.status !== "none" &&
              plan.id === "free" ? (
                <p className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
                  Your paid subscription is {subscriptionStatus.toLowerCase()}. You
                  can start a new subscription below.
                </p>
              ) : null}

              {plan.id === "free" ? (
                <CheckoutButton
                  plan="starter"
                  label="Upgrade to Starter"
                  className="mt-5"
                />
              ) : canManage ? (
                <ManageBillingButton className="mt-5" />
              ) : null}

              <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
                {hasPaidAccess
                  ? "Payments, invoices and cancellation are handled by Dodo Payments."
                  : "No payment method on file. No automatic renewal."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/70">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
                  <Gauge className="size-4" />
                </span>
                <div>
                  <CardTitle>Usage</CardTitle>
                  <p className="text-[11.5px] text-muted-foreground">
                    Your allowance for the current month.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Pages processed this month
                  </p>
                  <p className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em]">
                    {monthPages}
                    <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                      {plan.unlimited ? "unlimited" : `of ${plan.pageLimit}`}
                    </span>
                  </p>
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {plan.unlimited ? "Unlimited" : `${usagePercent}%`}
                </span>
              </div>

              {plan.unlimited ? (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-accent">
                  <div className="h-full w-full rounded-full bg-primary/45" />
                </div>
              ) : (
                <div
                  className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={monthPages}
                  aria-valuemin={0}
                  aria-valuemax={plan.pageLimit ?? 0}
                  aria-label="Monthly page allowance used"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              )}
              <p className="mt-2 text-[10.5px] text-muted-foreground">
                {plan.unlimited
                  ? "Your plan has no monthly page cap."
                  : `Allowance resets on ${nextAllowanceReset()}.`}
              </p>

              <dl className="mt-5 space-y-3 border-t border-border/70 pt-4 text-[11.5px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="size-3.5" />
                    Statements this month
                  </dt>
                  <dd className="font-medium text-foreground">{monthStatements}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="size-3.5" />
                    Statements in history
                  </dt>
                  <dd className="font-medium text-foreground">{totalStatements}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Gauge className="size-3.5" />
                    Transaction rows
                  </dt>
                  <dd className="font-medium text-foreground">{transactionCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="size-3.5" />
                    Conversions completed
                  </dt>
                  <dd className="font-medium text-foreground">
                    {usage.conversions_completed}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="size-3.5" />
                    Conversions failed
                  </dt>
                  <dd className="font-medium text-foreground">
                    {usage.conversions_failed}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <HardDrive className="size-3.5" />
                    Storage this month
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatFileSize(usage.storage_bytes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <LockKeyhole className="size-3.5" />
                    File size limit
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatFileSize(plan.fileSizeMb * 1024 * 1024)}
                  </dd>
                </div>
              </dl>

              <Link
                href="/statements"
                className="mt-4 inline-flex items-center gap-1.5 border-t border-border/70 pt-4 text-[11.5px] font-medium text-primary underline-offset-4 hover:underline"
              >
                View {pluralize(totalStatements, "statement")}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <section id="plans" className="mt-5 scroll-mt-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Plans</h2>
            <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
              Monthly subscriptions in USD. Tax is calculated at checkout by Dodo
              Payments, our merchant of record.
            </p>
          </div>
          {canManage ? (
            <ManageBillingButton
              variant="outline"
              className="w-full sm:w-auto"
              label={hasPaidAccess ? "Manage subscription" : "Billing history"}
            />
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((cataloguePlan) => {
            const current = cataloguePlan.id === plan.id;
            return (
              <Card
                key={cataloguePlan.id}
                className={cn(
                  "bg-white",
                  current && "border-primary/35 ring-1 ring-primary/10"
                )}
              >
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold">
                      {cataloguePlan.name}
                    </p>
                    {current ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[9.5px] font-semibold text-primary">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-[26px] font-semibold leading-none tracking-[-0.04em]">
                      {cataloguePlan.priceDisplay}
                    </span>
                    <span className="pb-0.5 text-[10.5px] text-muted-foreground">
                      / {cataloguePlan.cadence}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    {cataloguePlan.description}
                  </p>
                  <ul className="mt-4 space-y-1.5 text-[11px] leading-5 text-foreground/75">
                    {cataloguePlan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary/70" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-5">
                    {current ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Current plan
                      </Button>
                    ) : isPaidPlanId(cataloguePlan.id) ? (
                      hasPaidAccess && canManage ? (
                        <ManageBillingButton variant="outline" />
                      ) : (
                        <CheckoutButton
                          plan={cataloguePlan.id}
                          label={`Choose ${cataloguePlan.name}`}
                        />
                      )
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Free forever
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}
