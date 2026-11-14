import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  FileText,
  Gauge,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/app/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { logServerError } from "@/lib/log";
import {
  FREE_PLAN,
  currentMonthStartIso,
  nextAllowanceReset,
} from "@/lib/plans";
import { formatFileSize, pluralize } from "@/lib/utils";

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

export default async function SettingsPage() {
  const { user, supabase } = await requireUser();
  const monthStart = currentMonthStartIso();

  const [totalResult, monthResult, transactionResult] = await Promise.all([
    supabase.from("statements").select("id", { count: "exact", head: true }),
    supabase
      .from("statements")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart),
    supabase.from("transactions").select("id", { count: "exact", head: true }),
  ]);

  for (const result of [totalResult, monthResult, transactionResult]) {
    if (result.error) {
      logServerError("Could not load account usage", result.error);
    }
  }

  const totalStatements = totalResult.count ?? 0;
  const monthStatements = monthResult.count ?? 0;
  const transactionCount = transactionResult.count ?? 0;
  const usagePercent = Math.min(
    100,
    Math.round((monthStatements / FREE_PLAN.statementLimit) * 100)
  );

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";
  const displayName =
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
                <ProfileForm initialName={metadataName} />
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
                      {FREE_PLAN.name} plan
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold text-primary">
                  Current
                </span>
              </div>

              <div className="mt-5 flex items-end gap-1.5">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.04em]">
                  {FREE_PLAN.price}
                </span>
                <span className="pb-0.5 text-[11.5px] text-muted-foreground">
                  / month
                </span>
              </div>
              <p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">
                {FREE_PLAN.description}
              </p>

              <ul className="mt-4 space-y-2 border-t border-border/70 pt-4 text-[11.5px] text-foreground/75">
                <li className="flex items-center justify-between gap-3">
                  <span>Statements per month</span>
                  <span className="font-medium text-foreground">
                    {FREE_PLAN.statementLimit}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Maximum PDF size</span>
                  <span className="font-medium text-foreground">
                    {FREE_PLAN.fileSizeMb} MB
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span>Files per batch</span>
                  <span className="font-medium text-foreground">
                    {FREE_PLAN.batchLimit}
                  </span>
                </li>
              </ul>

              <Button asChild variant="outline" size="sm" className="mt-5 w-full">
                <Link href="/#pricing">
                  View plans
                  <ArrowRight />
                </Link>
              </Button>

              <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
                No payment method on file. No automatic renewal.
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
                    Statements this month
                  </p>
                  <p className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em]">
                    {monthStatements}
                    <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                      of {FREE_PLAN.statementLimit}
                    </span>
                  </p>
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {usagePercent}%
                </span>
              </div>

              <div
                className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={monthStatements}
                aria-valuemin={0}
                aria-valuemax={FREE_PLAN.statementLimit}
                aria-label="Monthly statement allowance used"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="mt-2 text-[10.5px] text-muted-foreground">
                Allowance resets on {nextAllowanceReset()}.
              </p>

              <dl className="mt-5 space-y-3 border-t border-border/70 pt-4 text-[11.5px]">
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
                    <LockKeyhole className="size-3.5" />
                    File size limit
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatFileSize(FREE_PLAN.fileSizeMb * 1024 * 1024)}
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
    </>
  );
}
