import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Gauge,
  ScanLine,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { logServerError } from "@/lib/log";
import { PageHeader } from "@/components/page-header";
import { UploadPanel } from "@/components/app/upload-panel";
import { ActiveRefresh } from "@/components/statements/active-refresh";
import { StatementStatusBadge } from "@/components/statement-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAccountData } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { readStatus, type StatementRecord } from "@/lib/domain";
import { currentMonthStartIso, nextAllowanceReset } from "@/lib/plans";
import {
  cn,
  formatDateTime,
  formatPeriod,
  pluralize,
} from "@/lib/utils";

const statStyles = {
  green: "bg-accent text-primary",
  sky: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
};

function StatCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: React.ReactNode;
  tone: keyof typeof statStyles;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.01em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.04em] text-foreground">
              {value.toLocaleString("en-GB")}
            </p>
          </div>
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-xl [&_svg]:size-4",
              statStyles[tone]
            )}
          >
            {icon}
          </span>
        </div>
        <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function RecentStatement({ statement }: { statement: StatementRecord }) {
  const status = readStatus(statement.status);
  return (
    <Link
      href={`/statements/${statement.id}`}
      className="group flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-muted/25 sm:px-5"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-primary ring-1 ring-border/60">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="max-w-full truncate text-[13px] font-medium text-foreground group-hover:text-primary">
            {statement.file_name}
          </p>
          <StatementStatusBadge status={status} />
        </div>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {statement.bank_name ? `${statement.bank_name} · ` : ""}
          {formatPeriod(statement.statement_start, statement.statement_end)} ·{" "}
          {formatDateTime(statement.created_at)}
        </p>
        {(status === "queued" || status === "processing") &&
        statement.processing_stage ? (
          <p className="mt-0.5 truncate text-[10.5px] text-primary">
            {statement.processing_stage}
            {typeof statement.progress_percent === "number"
              ? ` · ${statement.progress_percent}%`
              : ""}
          </p>
        ) : null}
      </div>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();
  const monthStart = currentMonthStartIso();

  const [
    account,
    recentResult,
    statementCountResult,
    transactionCountResult,
    reviewCountResult,
    failedCountResult,
    monthCountResult,
  ] = await Promise.all([
    loadAccountData(supabase, user.id),
    supabase
      .from("uploaded_documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("uploaded_documents")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("extracted_transactions")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("extracted_transactions")
      .select("id", { count: "exact", head: true })
      .eq("needs_review", true),
    supabase
      .from("uploaded_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    supabase
      .from("uploaded_documents")
      .select("page_count")
      .gte("created_at", monthStart)
      .in("status", ["completed", "partial"]),
  ]);

  for (const result of [
    recentResult,
    statementCountResult,
    transactionCountResult,
    reviewCountResult,
    failedCountResult,
    monthCountResult,
  ]) {
    if (result.error) {
      logServerError("Could not load dashboard data", result.error);
    }
  }

  const recent = recentResult.data ?? [];
  const statementCount = statementCountResult.count ?? 0;
  const transactionCount = transactionCountResult.count ?? 0;
  const reviewCount = reviewCountResult.count ?? 0;
  const failedCount = failedCountResult.count ?? 0;
  const { plan, usage } = account;
  const monthPages = account.usageAvailable
    ? usage.pages_processed
    : (monthCountResult.data ?? []).reduce(
        (total, document) => total + (document.page_count ?? 0),
        0
      );
  const usagePercent = plan.unlimited
    ? 0
    : Math.min(
        100,
        Math.round((monthPages / (plan.pageLimit ?? 1)) * 100)
      );
  const accountName =
    account.profile?.display_name?.trim() ||
    user.email?.split("@")[0]?.replace(/[._-]+/g, " ") ||
    "there";
  const hasActive = recent.some(
    (statement) =>
      statement.status === "queued" || statement.status === "processing"
  );

  return (
    <>
      <ActiveRefresh active={hasActive} />
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${accountName}`}
        description="Upload a bank statement, review the extracted ledger, then export clean Excel or CSV data."
        actions={
          <Button asChild>
            <a href="#upload">
              <UploadCloud />
              Upload statements
            </a>
          </Button>
        }
      />

      <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Documents processed"
          value={statementCount}
          note="Every statement in your private conversion history."
          icon={<FileCheck2 />}
          tone="green"
        />
        <StatCard
          label="Transactions captured"
          value={transactionCount}
          note="Editable rows available to review and export."
          icon={<FileSpreadsheet />}
          tone="sky"
        />
        <StatCard
          label="Need review"
          value={reviewCount}
          note="Rows flagged by extraction for a quick check."
          icon={<AlertTriangle />}
          tone="amber"
        />
        <StatCard
          label="Failed conversions"
          value={failedCount}
          note="Statements that did not produce reliable data."
          icon={<FileText />}
          tone="rose"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <UploadPanel maxFiles={plan.batchLimit} />

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/70">
              <div>
                <CardTitle>Recent conversions</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick up an extraction, finish a review, or export a completed
                  statement.
                </p>
              </div>
              {recent.length ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/statements">
                    View all
                    <ArrowRight />
                  </Link>
                </Button>
              ) : null}
            </CardHeader>
            {recent.length ? (
              <div className="divide-y divide-border/70">
                {recent.map((statement) => (
                  <RecentStatement key={statement.id} statement={statement} />
                ))}
              </div>
            ) : (
              <CardContent className="pt-5">
                <EmptyState
                  brand
                  icon={<FileText className="size-5" />}
                  title="No statements yet"
                  description="Upload your first PDF above. We support digital statements and scanned copies with OCR."
                  action={
                    <Button asChild variant="outline">
                      <a href="#upload">
                        <UploadCloud />
                        Upload a statement
                      </a>
                    </Button>
                  }
                  className="bg-transparent py-10"
                />
              </CardContent>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
                    <Gauge className="size-4" />
                  </span>
                  <div>
                    <p className="text-[10.5px] font-medium tracking-[0.01em] text-muted-foreground">
                      Plan usage
                    </p>
                    <p className="text-[13px] font-semibold text-foreground">
                      {plan.name} plan
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold text-primary">
                  Current
                </span>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3">
                <p className="text-[13px] font-medium text-foreground">
                  {monthPages}
                  <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">
                    {plan.unlimited
                      ? "pages processed this month"
                      : `of ${plan.pageLimit} pages this month`}
                  </span>
                </p>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {plan.unlimited ? "Unlimited" : `${usagePercent}%`}
                </span>
              </div>

              {plan.unlimited ? (
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-accent">
                  <div className="h-full w-full rounded-full bg-primary/45" />
                </div>
              ) : (
                <div
                  className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
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
                  : `Resets on ${nextAllowanceReset()}.`}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-[11px]">
                <span className="text-muted-foreground">Transactions stored</span>
                <span className="font-medium text-foreground">
                  {pluralize(transactionCount, "row")}
                </span>
              </div>

              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link href="/settings">
                  View usage &amp; settings
                  <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 bg-[#f7fbf9]">
            <CardContent className="p-5">
              <p className="text-[10.5px] font-semibold tracking-[0.01em] text-primary">
                What you get
              </p>
              <h3 className="mt-2 text-[14px] font-semibold tracking-tight">
                A review step, not a black box
              </h3>
              <div className="mt-4 space-y-4">
                {[
                  {
                    icon: ScanLine,
                    title: "Read any statement",
                    body: "Digital text layer first, OCR fallback for scans.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Keep every row visible",
                    body: "Uncertain rows are kept and flagged, never silently dropped.",
                  },
                  {
                    icon: FileSpreadsheet,
                    title: "Export when ready",
                    body: "Editable preview, then a summary workbook or plain CSV.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-primary ring-1 ring-emerald-100">
                      <item.icon className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-[12px] font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
