import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Download,
  FileText,
  SearchX,
  UploadCloud,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ActiveRefresh } from "@/components/statements/active-refresh";
import { StatementStatusBadge } from "@/components/statement-status-badge";
import { logServerError } from "@/lib/log";
import { StatementsToolbar } from "@/components/statements/statements-toolbar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { readStatus, readValidation } from "@/lib/domain";
import {
  formatDateTime,
  formatPeriod,
  pluralize,
} from "@/lib/utils";

export const metadata: Metadata = { title: "Statements" };

const PAGE_SIZE = 20;

function parseStatus(value: string | undefined): {
  filter: "all" | "completed" | "partial" | "active" | "failed";
  query: string;
  label: string;
} {
  if (value === "completed") {
    return { filter: "completed", query: "completed", label: "Extracted" };
  }
  if (value === "partial") {
    return { filter: "partial", query: "partial", label: "Needs review" };
  }
  if (value === "failed") {
    return { filter: "failed", query: "failed", label: "Failed" };
  }
  if (value === "active") {
    return { filter: "active", query: "active", label: "Processing" };
  }
  return { filter: "all", query: "all", label: "All statuses" };
}

function pageHref(page: number, query: string, status: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/statements?${search}` : "/statements";
}

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { supabase } = await requireUser();
  const params = await searchParams;
  const query = (params.q ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 100);
  const statusFilter = parseStatus(params.status);
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  let request = supabase
    .from("statements")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (query) {
    request = request.ilike("file_name", `%${query}%`);
  }
  if (statusFilter.filter === "active") {
    request = request.in("status", ["queued", "processing"]);
  } else if (statusFilter.filter !== "all") {
    request = request.eq("status", statusFilter.filter);
  }

  const from = (requestedPage - 1) * PAGE_SIZE;
  const { data: statements, count, error } = await request.range(
    from,
    from + PAGE_SIZE - 1
  );

  if (error) {
    logServerError("Could not load statements", error);
  }

  const rows = statements ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(query) || statusFilter.filter !== "all";
  const hasActive = rows.some(
    (statement) =>
      statement.status === "queued" || statement.status === "processing"
  );

  return (
    <>
      <ActiveRefresh active={hasActive} />
      <PageHeader
        eyebrow="History"
        title="Statements"
        description="Every conversion stays in your private workspace. Open a statement to review rows, fix values, retry a failed extraction, or export."
        actions={
          <Button asChild>
            <Link href="/dashboard#upload">
              <UploadCloud />
              New conversion
            </Link>
          </Button>
        }
      />

      <StatementsToolbar initialQuery={query} status={statusFilter.filter} />

      <div className="mb-3 flex items-center justify-between px-0.5">
        <p className="text-[11.5px] text-muted-foreground">
          {total === 0
            ? hasFilters
              ? "No matching statements"
              : "No statements yet"
            : `${pluralize(total, "statement")}${hasFilters ? ` matching ${statusFilter.label.toLowerCase()}` : ""}`}
        </p>
        {totalPages > 1 ? (
          <p className="text-[11.5px] text-muted-foreground">
            Page {Math.min(requestedPage, totalPages)} of {totalPages}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(20,32,28,0.03)]">
        {rows.length ? (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Statement</TableHead>
                    <TableHead>Bank / account</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="w-12 pr-5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((statement) => {
                    const validation = readValidation(statement.validation);
                    const status = readStatus(statement.status);
                    const canExport =
                      (status === "completed" || status === "partial") &&
                      (validation.transaction_count ?? 0) > 0;
                    return (
                      <TableRow key={statement.id} className="group">
                        <TableCell className="max-w-[300px] py-3.5 pl-5">
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-primary ring-1 ring-border/60">
                              <FileText className="size-3.5" />
                            </span>
                            <div className="min-w-0">
                              <Link
                                href={`/statements/${statement.id}`}
                                className="block truncate text-[12.5px] font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                              >
                                {statement.file_name}
                              </Link>
                              <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
                                {statement.extraction_method
                                  ? `${statement.extraction_method.toUpperCase()} · ${pluralize(statement.page_count ?? 0, "page")}`
                                  : "Awaiting extraction"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-[12px] text-foreground">
                            {statement.bank_name || "—"}
                          </p>
                          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                            {statement.account_number_last4
                              ? `Account •••• ${statement.account_number_last4}`
                              : "Account not detected"}
                          </p>
                        </TableCell>
                        <TableCell className="text-[11.5px] text-muted-foreground">
                          {formatPeriod(statement.statement_start, statement.statement_end)}
                        </TableCell>
                        <TableCell className="text-right text-[12px] tabular-nums text-foreground">
                          {validation.transaction_count || "—"}
                        </TableCell>
                        <TableCell>
                          <StatementStatusBadge status={readStatus(statement.status)} />
                          {status === "processing" && statement.processing_stage ? (
                            <p className="mt-1 max-w-[180px] truncate text-[10px] text-muted-foreground">
                              {statement.processing_stage}
                              {typeof statement.progress_percent === "number"
                                ? ` · ${statement.progress_percent}%`
                                : ""}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {formatDateTime(statement.created_at)}
                        </TableCell>
                        <TableCell className="pr-5">
                          <div className="flex items-center justify-end gap-0.5">
                            {canExport ? (
                              <a
                                href={`/api/statements/${statement.id}/export?format=xlsx`}
                                className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-primary"
                                aria-label={`Download Excel for ${statement.file_name}`}
                              >
                                <Download className="size-3.5" />
                              </a>
                            ) : null}
                            <Link
                              href={`/statements/${statement.id}`}
                              className="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-primary"
                              aria-label={`Open ${statement.file_name}`}
                            >
                              <ArrowUpRight className="size-4" />
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border/70 lg:hidden">
              {rows.map((statement) => {
                const validation = readValidation(statement.validation);
                const status = readStatus(statement.status);
                const canExport =
                  (status === "completed" || status === "partial") &&
                  (validation.transaction_count ?? 0) > 0;
                return (
                  <div
                    key={statement.id}
                    className="group flex items-start gap-2 px-4 py-4 transition-colors hover:bg-muted/20"
                  >
                    <Link
                      href={`/statements/${statement.id}`}
                      className="flex min-w-0 flex-1 items-start gap-3"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-primary ring-1 ring-border/60">
                        <FileText className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="max-w-full truncate text-[12.5px] font-medium text-foreground group-hover:text-primary">
                            {statement.file_name}
                          </p>
                          <StatementStatusBadge status={status} />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {statement.bank_name ? `${statement.bank_name} · ` : ""}
                          {formatPeriod(statement.statement_start, statement.statement_end)}
                        </p>
                        <p className="mt-1 text-[10.5px] text-muted-foreground">
                          {validation.transaction_count
                            ? pluralize(validation.transaction_count, "row")
                            : "No rows"}{" "}
                          · {formatDateTime(statement.created_at)}
                          {status === "processing" && statement.processing_stage
                            ? ` · ${statement.processing_stage}${
                                typeof statement.progress_percent === "number"
                                  ? ` ${statement.progress_percent}%`
                                  : ""
                              }`
                            : ""}
                        </p>
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {canExport ? (
                        <a
                          href={`/api/statements/${statement.id}/export?format=xlsx`}
                          className="flex size-8 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-primary"
                          aria-label={`Download Excel for ${statement.file_name}`}
                        >
                          <Download className="size-4" />
                        </a>
                      ) : null}
                      <Link
                        href={`/statements/${statement.id}`}
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground/50"
                        aria-label={`Open ${statement.file_name}`}
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-5">
            {hasFilters ? (
              <EmptyState
                icon={<SearchX className="size-5" />}
                title="No statements match those filters"
                description="Try a different file name or clear the status filter to see the rest of your history."
                action={
                  <Button asChild variant="outline">
                    <Link href="/statements">Clear filters</Link>
                  </Button>
                }
                className="border-0 bg-transparent py-12"
              />
            ) : (
              <EmptyState
                brand
                icon={<FileText className="size-5" />}
                title="Your conversion history starts here"
                description="Upload a bank statement PDF to extract its transactions. Digital and scanned documents are both supported."
                action={
                  <Button asChild>
                    <Link href="/dashboard#upload">
                      <UploadCloud />
                      Upload a statement
                    </Link>
                  </Button>
                }
                className="border-0 bg-transparent py-12"
              />
            )}
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <nav
          className="mt-5 flex items-center justify-between"
          aria-label="Statement pagination"
        >
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={requestedPage <= 1}
            className={requestedPage <= 1 ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={pageHref(Math.max(1, requestedPage - 1), query, statusFilter.filter)}>
              <ArrowLeft />
              Previous
            </Link>
          </Button>
          <p className="text-[11.5px] text-muted-foreground">
            {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total}
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={requestedPage >= totalPages}
            className={requestedPage >= totalPages ? "pointer-events-none opacity-40" : ""}
          >
            <Link href={pageHref(Math.min(totalPages, requestedPage + 1), query, statusFilter.filter)}>
              Next
              <ArrowRight />
            </Link>
          </Button>
        </nav>
      ) : null}
    </>
  );
}
