"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Landmark,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  UploadCloud,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { ExtractionReportPanel } from "@/components/statements/extraction-report-panel";
import { ReconciliationPanel } from "@/components/statements/reconciliation-panel";
import { StatementStatusBadge } from "@/components/statement-status-badge";
import { TransactionEditor } from "@/components/statements/transaction-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { statementStatus } from "@/lib/constants";
import {
  isProcessingStatus,
  readStatus,
  readValidation,
  type StatementPayload,
  type StatementRecord,
  type TransactionRecord,
} from "@/lib/domain";
import {
  formatDateTime,
  formatFileSize,
  formatMoney,
  formatPeriod,
  pluralize,
} from "@/lib/utils";

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 break-words text-[11.5px] leading-5 text-foreground">
          {value}
        </div>
      </div>
    </div>
  );
}

function ProcessingPanel({ status }: { status: string }) {
  return (
    <Card>
      <CardContent className="px-5 py-10 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <p className="mt-4 text-sm font-semibold text-foreground">
          {status === "queued"
            ? "Your statement is queued"
            : "Extracting transactions"}
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-6 text-muted-foreground">
          {status === "queued"
            ? "The processing service will start shortly. This page refreshes automatically."
            : "We are reading the text layer, falling back to OCR where needed, and checking every balance. Scanned documents can take a little longer."}
        </p>
        <div className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
          {[
            "Reading the PDF and detecting the table layout",
            "Parsing dates, descriptions, and amounts",
            "Checking opening and closing balances",
            "Saving the editable transaction preview",
          ].map((step, index) => (
            <div key={step} className="flex items-center gap-2.5 text-[11px]">
              <span className="flex size-5 items-center justify-center rounded-full border border-border bg-card text-[9px] font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatementDetail({
  initialStatement,
  initialTransactions,
}: {
  initialStatement: StatementRecord;
  initialTransactions: TransactionRecord[];
}) {
  const router = useRouter();
  const [payload, setPayload] = React.useState<StatementPayload>({
    statement: initialStatement,
    transactions: initialTransactions,
  });
  const [dirty, setDirty] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [pollIssue, setPollIssue] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const statement = payload.statement;
  const transactions = payload.transactions;
  const status = readStatus(statement.status);
  const processing = isProcessingStatus(status);
  const validation = readValidation(statement.validation);
  const canRetry =
    (status === "failed" || status === "uploaded") && transactions.length === 0;

  React.useEffect(() => {
    if (!processing) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/statements/${statement.id}`, {
          cache: "no-store",
        });
        if (response.status === 404) {
          toast.error("This statement no longer exists.");
          router.replace("/statements");
          router.refresh();
          return;
        }
        if (!response.ok) {
          setPollIssue("Automatic refresh is having trouble. Retrying…");
        } else {
          const next = (await response.json()) as StatementPayload;
          if (cancelled) return;
          setPayload(next);
          setPollIssue(null);
          const nextStatus = readStatus(next.statement.status);
          if (
            nextStatus === "completed" ||
            nextStatus === "partial" ||
            nextStatus === "failed"
          ) {
            if (nextStatus === "completed") {
              toast.success("Extraction complete", {
                description: `${pluralize(next.transactions.length, "transaction")} ready for review.`,
              });
            } else if (nextStatus === "partial") {
              toast.message("Extraction needs review", {
                description:
                  next.statement.error_message ||
                  "Rows were kept, but some values are flagged for attention.",
              });
            } else {
              toast.error("Extraction failed", {
                description:
                  next.statement.error_message ||
                  "No reliable transactions could be extracted.",
              });
            }
            router.refresh();
            return;
          }
        }
      } catch {
        if (!cancelled) {
          setPollIssue("Automatic refresh is having trouble. Retrying…");
        }
      }
      if (!cancelled) timer = setTimeout(poll, 2500);
    }

    timer = setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [processing, router, statement.id]);

  async function refreshOnce() {
    setRefreshing(true);
    setPollIssue(null);
    try {
      const response = await fetch(`/api/statements/${statement.id}`, {
        cache: "no-store",
      });
      if (response.ok) {
        setPayload((await response.json()) as StatementPayload);
      } else {
        setPollIssue("This statement could not be refreshed.");
      }
    } catch {
      setPollIssue("This statement could not be refreshed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function retryExtraction() {
    if (retrying || !canRetry) return;
    setRetrying(true);
    setPollIssue(null);
    try {
      const response = await fetch(
        `/api/statements/${statement.id}/process`,
        { method: "POST" }
      );
      let message: string | undefined;
      try {
        const body = (await response.json()) as { error?: string };
        message = body.error;
      } catch {
        message = undefined;
      }

      if (!response.ok) {
        toast.error(message || "Could not start extraction.");
        await refreshOnce();
        setRetrying(false);
        return;
      }

      setPayload((current) => ({
        ...current,
        statement: {
          ...current.statement,
          status: "queued",
          error_message: null,
          processed_at: null,
        },
      }));
      toast.message("Extraction queued", {
        description: "This page will update automatically when it finishes.",
      });
      setRetrying(false);
    } catch {
      toast.error("Could not reach the processing service.");
      setRetrying(false);
    }
  }

  async function deleteStatement() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/statements/${statement.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = "Could not delete this statement.";
        try {
          const body = (await response.json()) as { error?: string };
          message = body.error || message;
        } catch {
          // Keep the fallback message.
        }
        setDeleteError(message);
        setDeleting(false);
        return;
      }
      toast.success("Statement deleted");
      router.replace("/statements");
      router.refresh();
    } catch {
      setDeleteError("Could not delete this statement. Check your connection.");
      setDeleting(false);
    }
  }

  function guardExport(event: React.MouseEvent<HTMLAnchorElement>) {
    if (processing) {
      event.preventDefault();
      toast.error("Extraction is still running", {
        description: "Wait for the statement to finish before exporting.",
      });
      return;
    }
    if (!dirty) return;
    event.preventDefault();
    toast.error("Save your changes before exporting", {
      description:
        "Exports use the saved ledger. Save or discard your draft changes first.",
    });
  }

  const headerDescription = [
    statement.bank_name || "Bank not detected",
    formatPeriod(statement.statement_start, statement.statement_end),
    statement.page_count ? pluralize(statement.page_count, "page") : null,
    statement.extraction_method
      ? `${statement.extraction_method.toUpperCase()} extraction`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <Link
        href="/statements"
        className="mb-5 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to statements
      </Link>

      <header className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatementStatusBadge status={status} size="lg" />
            <span className="text-[10.5px] text-muted-foreground">
              Uploaded {formatDateTime(statement.created_at)}
              {statement.processed_at
                ? ` · Processed ${formatDateTime(statement.processed_at)}`
                : ""}
            </span>
          </div>
          <h1 className="break-words text-[24px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[28px]">
            {statement.file_name}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-6 text-muted-foreground">
            {headerDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/statements/${statement.id}/file`}>
              <FileDown />
              Original PDF
            </a>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download />
                Export
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Download saved data</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a
                  href={`/api/statements/${statement.id}/export?format=xlsx`}
                  onClick={guardExport}
                >
                  <FileSpreadsheet />
                  Excel workbook
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`/api/statements/${statement.id}/export?format=csv`}
                  onClick={guardExport}
                >
                  <FileText />
                  CSV file
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="More statement actions"
                className="size-9"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Statement</DropdownMenuLabel>
              <DropdownMenuItem
                variant="danger"
                onSelect={(event) => {
                  event.preventDefault();
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 />
                Delete statement
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {status === "failed" ? (
        <Alert variant="danger" className="mb-5">
          <AlertCircle />
          <AlertDescription>
            <AlertTitle>Extraction failed</AlertTitle>
            <p className="mt-0.5 leading-5">
              {statement.error_message ||
                "No reliable transactions could be extracted from this document."}
            </p>
            {transactions.length === 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canRetry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void retryExtraction()}
                    disabled={retrying}
                  >
                    {retrying ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw />
                    )}
                    {retrying ? "Starting…" : "Retry extraction"}
                  </Button>
                ) : null}
                <span className="text-[11px] text-rose-800/80">
                  You can also add rows manually below. Nothing is invented for you.
                </span>
              </div>
            ) : (
              <p className="mt-1.5 text-[11px]">
                Your saved manual rows are still available below. Extraction is
                not retried because it would replace them.
              </p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {status === "uploaded" ? (
        <Alert variant="warning" className="mb-5">
          <UploadCloud />
          <AlertDescription>
            <AlertTitle>This upload has not been processed</AlertTitle>
            <p className="mt-0.5 leading-5">
              Start extraction to read the PDF, or add rows manually below.
            </p>
            {canRetry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void retryExtraction()}
                disabled={retrying}
              >
                {retrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {retrying ? "Starting…" : "Start extraction"}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {processing ? (
        <Alert variant="info" className="mb-5">
          <Loader2 className="animate-spin" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {status === "queued"
                ? "The statement is queued for extraction. This page updates automatically."
                : "Extraction is running. This page updates automatically when it finishes."}
              {pollIssue ? (
                <span className="mt-1 block text-[11px] text-sky-900/70">
                  {pollIssue}
                </span>
              ) : null}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void refreshOnce()}
              disabled={refreshing}
              className="text-sky-900 hover:bg-sky-100"
            >
              {refreshing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Refresh now
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {status === "partial" ? (
        <Alert variant="warning" className="mb-5">
          <AlertTriangle />
          <AlertDescription>
            <AlertTitle>Some rows need your attention</AlertTitle>
            <p className="mt-0.5 leading-5">
              {validation.needs_review_count > 0
                ? `${pluralize(validation.needs_review_count, "row")} flagged by extraction. `
                : "Some extracted values or source lines need a check. "}
              The rows were kept — check the highlighted values, fix anything that
              looks wrong, then save and export when the reconciliation looks right.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {status === "completed" &&
      validation.status === "mismatch" &&
      !processing ? (
        <Alert variant="warning" className="mb-5">
          <AlertTriangle />
          <AlertDescription>
            <AlertTitle>The saved rows no longer reconcile</AlertTitle>
            <p className="mt-0.5 leading-5">
              Your edits changed the totals. Check the reconciliation panel and
              the highlighted rows before exporting.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {dirty ? (
        <Alert variant="default" className="mb-5">
          <AlertCircle />
          <AlertDescription>
            You have unsaved edits. Save them before exporting or leaving this
            page.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="min-w-0 space-y-5">
          {processing ? (
            <ProcessingPanel status={status} />
          ) : (
            <TransactionEditor
              statement={statement}
              transactions={transactions}
              onSaved={(next) => setPayload(next)}
              onDirtyChange={setDirty}
            />
          )}
          <ExtractionReportPanel statement={statement} />
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="border-b border-border/70">
              <CardTitle>Statement details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-5">
              <DetailItem
                icon={<Landmark className="size-3.5" />}
                label="Bank"
                value={statement.bank_name || "Not detected"}
              />
              <DetailItem
                icon={<WalletCards className="size-3.5" />}
                label="Account"
                value={
                  statement.account_number_last4
                    ? `•••• ${statement.account_number_last4}`
                    : "Not detected"
                }
              />
              <DetailItem
                icon={<UserRound className="size-3.5" />}
                label="Account holder"
                value={statement.account_holder || "Not detected"}
              />
              <DetailItem
                icon={<CalendarDays className="size-3.5" />}
                label="Statement period"
                value={formatPeriod(
                  statement.statement_start,
                  statement.statement_end
                )}
              />
              <div className="grid grid-cols-2 gap-4 border-t border-border/70 pt-4">
                <DetailItem
                  icon={<FileText className="size-3.5" />}
                  label="File"
                  value={`${formatFileSize(statement.file_size)}${
                    statement.page_count
                      ? ` · ${pluralize(statement.page_count, "page")}`
                      : ""
                  }`}
                />
                <DetailItem
                  icon={<FileSpreadsheet className="size-3.5" />}
                  label="Currency / method"
                  value={[
                    statement.currency || "Unknown currency",
                    statement.extraction_method
                      ? statement.extraction_method.toUpperCase()
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <div>
                  <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
                    Opening / closing
                  </p>
                  <p className="mt-1 text-[11.5px] tabular-nums text-foreground">
                    {formatMoney(statement.opening_balance, statement.currency)}
                    {" → "}
                    {formatMoney(statement.closing_balance, statement.currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
                    Rows
                  </p>
                  <p className="mt-1 text-[11.5px] tabular-nums text-foreground">
                    {pluralize(transactions.length, "row")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ReconciliationPanel statement={statement} />

          <div className="rounded-xl border border-border/70 bg-card/50 px-4 py-3 text-[10.5px] leading-5 text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground/80">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Current status
            </p>
            <p className="mt-1">
              {statementStatus[status].description}
            </p>
          </div>
        </aside>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this statement?</DialogTitle>
            <DialogDescription>
              This permanently deletes the PDF, all extracted transactions, and
              every saved edit. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {processing ? (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertDescription>
                Extraction is still running. Deleting the statement cancels it and
                discards any partial work.
              </AlertDescription>
            </Alert>
          ) : null}
          {deleteError ? (
            <Alert variant="danger">
              <AlertCircle />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deleteStatement()}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {deleting ? "Deleting…" : "Delete statement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
