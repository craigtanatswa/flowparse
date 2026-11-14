"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  StatementPayload,
  StatementRecord,
  TransactionRecord,
} from "@/lib/domain";
import {
  computeLiveReconciliation,
  readReviewReasons,
} from "@/lib/domain";
import { transactionUpsertSchema } from "@/lib/validation";
import {
  cn,
  formatAmount,
  formatMoney,
  pluralize,
  toDateInputValue,
} from "@/lib/utils";

interface RowDraft {
  key: string;
  id: string | null;
  date: string;
  valueDate: string;
  description: string;
  reference: string;
  debit: string;
  credit: string;
  balance: string;
  currency: string;
  pageNumber: number | null;
  needsReview: boolean;
  reviewReasons: string[];
  edited: boolean;
  source: string;
}

interface SaveResponse extends StatementPayload {
  error?: string;
}

function toDraft(transaction: TransactionRecord): RowDraft {
  return {
    key: transaction.id,
    id: transaction.id,
    date: toDateInputValue(transaction.txn_date),
    valueDate: toDateInputValue(transaction.value_date),
    description: transaction.description,
    reference: transaction.reference ?? "",
    debit: formatAmount(transaction.debit),
    credit: formatAmount(transaction.credit),
    balance: formatAmount(transaction.balance),
    currency: transaction.currency ?? "",
    pageNumber: transaction.page_number,
    needsReview: transaction.needs_review,
    reviewReasons: readReviewReasons(transaction.review_reasons),
    edited: transaction.edited,
    source: transaction.source,
  };
}

function makeDraft(statement: StatementRecord): RowDraft {
  return {
    key: `manual-${crypto.randomUUID()}`,
    id: null,
    date: toDateInputValue(statement.statement_end),
    valueDate: "",
    description: "",
    reference: "",
    debit: "",
    credit: "",
    balance: "",
    currency: statement.currency ?? "",
    pageNumber: null,
    needsReview: false,
    reviewReasons: [],
    edited: true,
    source: "manual",
  };
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function TransactionEditor({
  statement,
  transactions,
  onSaved,
  onDirtyChange,
}: {
  statement: StatementRecord;
  transactions: TransactionRecord[];
  onSaved: (payload: StatementPayload) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [rows, setRows] = React.useState<RowDraft[]>(() =>
    transactions.map(toDraft)
  );
  const [dirtyKeys, setDirtyKeys] = React.useState<Set<string>>(() => new Set());
  const [deletedIds, setDeletedIds] = React.useState<Set<string>>(() => new Set());
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [stale, setStale] = React.useState(false);
  const lastSignature = React.useRef(
    transactions.map((transaction) => `${transaction.id}:${transaction.updated_at}`).join("|")
  );

  const hasChanges = dirtyKeys.size > 0 || deletedIds.size > 0;
  const unsavedCount = dirtyKeys.size + deletedIds.size;

  const live = React.useMemo(
    () =>
      computeLiveReconciliation(
        rows.map((row) => ({
          date: row.date,
          description: row.description,
          debit: row.debit,
          credit: row.credit,
          balance: row.balance,
        })),
        statement.opening_balance,
        statement.closing_balance
      ),
    [rows, statement.opening_balance, statement.closing_balance]
  );

  const signature = transactions
    .map((transaction) => `${transaction.id}:${transaction.updated_at}`)
    .join("|");

  React.useEffect(() => {
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;
    setRows(transactions.map(toDraft));
    setDirtyKeys(new Set());
    setDeletedIds(new Set());
    setSaveError(null);
    setStale(false);
  }, [signature, transactions]);

  React.useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  React.useEffect(() => {
    if (!hasChanges) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasChanges]);

  function markDirty(key: string) {
    setDirtyKeys((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function updateField(
    key: string,
    field:
      | "date"
      | "valueDate"
      | "description"
      | "reference"
      | "debit"
      | "credit"
      | "balance"
      | "currency",
    value: string
  ) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    );
    markDirty(key);
    setSaveError(null);
    setStale(false);
  }

  function addRow() {
    const row = makeDraft(statement);
    setRows((current) => [...current, row]);
    markDirty(row.key);
    setSaveError(null);
    setStale(false);
  }

  function removeRow(row: RowDraft) {
    setRows((current) => current.filter((item) => item.key !== row.key));
    setDirtyKeys((current) => {
      if (!current.has(row.key)) return current;
      const next = new Set(current);
      next.delete(row.key);
      return next;
    });
    if (row.id) {
      setDeletedIds((current) => new Set(current).add(row.id as string));
    }
    setSaveError(null);
    setStale(false);
  }

  function resetChanges() {
    if (!hasChanges || saving) return;
    if (!window.confirm("Discard all unsaved changes to this statement?")) return;
    setRows(transactions.map(toDraft));
    setDirtyKeys(new Set());
    setDeletedIds(new Set());
    setSaveError(null);
    setStale(false);
  }

  async function saveChanges() {
    if (!hasChanges || saving) return;
    setSaving(true);
    setSaveError(null);
    setStale(false);

    const dirtyRows = rows.filter((row) => dirtyKeys.has(row.key));
    const upserts: Array<{
      id: string | null;
      date: string | null;
      value_date: string | null;
      description: string;
      reference: string | null;
      debit: string | null;
      credit: string | null;
      balance: string | null;
      currency: string | null;
    }> = [];

    for (const row of dirtyRows) {
      const index = rows.findIndex((item) => item.key === row.key);
      const parsed = transactionUpsertSchema.safeParse({
        id: row.id ?? undefined,
        date: row.date,
        value_date: row.valueDate,
        description: row.description,
        reference: row.reference,
        debit: row.debit,
        credit: row.credit,
        balance: row.balance,
        currency: row.currency,
      });
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message || "This row is invalid.";
        setSaveError(`Row ${index + 1}: ${message}`);
        setSaving(false);
        return;
      }
      upserts.push({
        id: row.id,
        date: parsed.data.date || null,
        value_date: parsed.data.value_date || null,
        description: parsed.data.description,
        reference: parsed.data.reference,
        debit: parsed.data.debit,
        credit: parsed.data.credit,
        balance: parsed.data.balance,
        currency: parsed.data.currency,
      });
    }

    try {
      const response = await fetch(
        `/api/statements/${statement.id}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upserts,
            deletes: Array.from(deletedIds),
          }),
        }
      );
      const payload = await readJson<SaveResponse>(response);

      if (!response.ok || !payload) {
        setSaveError(
          payload?.error ||
            "Your changes could not be saved. Check your connection and try again."
        );
        setStale(response.status === 409);
        setSaving(false);
        return;
      }

      setRows(payload.transactions.map(toDraft));
      lastSignature.current = payload.transactions
        .map((transaction) => `${transaction.id}:${transaction.updated_at}`)
        .join("|");
      setDirtyKeys(new Set());
      setDeletedIds(new Set());
      setSaving(false);
      setStale(false);
      onSaved(payload);
      toast.success("Changes saved", {
        description: "The reconciliation has been recalculated.",
      });
    } catch {
      setSaveError(
        "Your changes could not be saved. Check your connection and try again."
      );
      setSaving(false);
    }
  }

  function reloadStatement() {
    if (hasChanges && !window.confirm("Reload and discard your unsaved changes?")) {
      return;
    }
    window.location.reload();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70">
        <div>
          <CardTitle>Transactions</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Edit any value inline. Changes are only applied to your saved ledger
            when you press save.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus />
            Add row
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void saveChanges()}
            disabled={saving || !hasChanges}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardHeader>

      <div className="grid grid-cols-2 gap-px border-b border-border/70 bg-border/70 sm:grid-cols-4">
        <div className="bg-[#fafcfb] px-4 py-3">
          <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
            Draft money in
          </p>
          <p className="mt-1 text-[12.5px] font-semibold tabular-nums text-emerald-700">
            {formatMoney(live.totalCredits, statement.currency)}
          </p>
        </div>
        <div className="bg-[#fafcfb] px-4 py-3">
          <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
            Draft money out
          </p>
          <p className="mt-1 text-[12.5px] font-semibold tabular-nums text-rose-700">
            {formatMoney(live.totalDebits, statement.currency)}
          </p>
        </div>
        <div className="bg-[#fafcfb] px-4 py-3">
          <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
            Computed closing
          </p>
          <p className="mt-1 text-[12.5px] font-semibold tabular-nums text-foreground">
            {live.computedClosing === null
              ? "—"
              : formatMoney(live.computedClosing, statement.currency)}
          </p>
        </div>
        <div className="bg-[#fafcfb] px-4 py-3">
          <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
            Draft difference
          </p>
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-[12.5px] font-semibold tabular-nums",
              live.difference !== null && Math.abs(live.difference) < 0.005
                ? "text-emerald-700"
                : "text-foreground"
            )}
          >
            {live.difference !== null && Math.abs(live.difference) < 0.005 ? (
              <Check className="size-3.5" />
            ) : null}
            {live.difference === null
              ? "—"
              : formatMoney(live.difference, statement.currency)}
          </p>
        </div>
      </div>

      {saveError ? (
        <div className="border-b border-border/70 p-4 pb-0">
          <Alert variant={stale ? "warning" : "danger"}>
            <AlertCircle />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{saveError}</span>
              {stale ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={reloadStatement}
                >
                  Reload statement
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {live.incompleteRows > 0 ? (
        <div className="border-b border-border/70 px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="size-3.5 text-amber-600" />
            {pluralize(live.incompleteRows, "row")} in this draft still need a date,
            description, and debit or credit.
          </p>
        </div>
      ) : null}

      {rows.length ? (
        <div className="overflow-x-auto">
          <Table className="min-w-[1240px]">
            <TableHeader className="bg-muted/25">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-4 text-center">#</TableHead>
                <TableHead className="w-[138px]">Date</TableHead>
                <TableHead className="w-[138px]">Value date</TableHead>
                <TableHead className="min-w-[280px]">Description</TableHead>
                <TableHead className="w-[150px]">Reference</TableHead>
                <TableHead className="w-[82px]">Currency</TableHead>
                <TableHead className="w-[126px] text-right">Debit</TableHead>
                <TableHead className="w-[126px] text-right">Credit</TableHead>
                <TableHead className="w-[132px] text-right">Balance</TableHead>
                <TableHead className="w-12 pr-3">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const rowIncomplete =
                  !row.date ||
                  !row.description.trim() ||
                  (!row.debit.trim() && !row.credit.trim());
                const needsAttention =
                  row.needsReview || rowIncomplete || row.reviewReasons.length > 0;
                return (
                  <TableRow
                    key={row.key}
                    className={cn(
                      "align-top",
                      needsAttention && "bg-amber-50/35 hover:bg-amber-50/50"
                    )}
                  >
                    <TableCell className="pl-4 pt-3.5 text-center text-[10.5px] tabular-nums text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        type="date"
                        value={row.date}
                        onChange={(event) =>
                          updateField(row.key, "date", event.target.value)
                        }
                        aria-label={`Date for row ${index + 1}`}
                        className="h-8 border-transparent bg-transparent px-1.5 text-[11px] shadow-none hover:border-input focus-visible:bg-card"
                      />
                      {row.pageNumber ? (
                        <p className="mt-0.5 pl-1.5 text-[9px] tracking-[0.02em] text-muted-foreground">
                          Page {row.pageNumber}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        type="date"
                        value={row.valueDate}
                        onChange={(event) =>
                          updateField(row.key, "valueDate", event.target.value)
                        }
                        aria-label={`Value date for row ${index + 1}`}
                        className="h-8 border-transparent bg-transparent px-1.5 text-[11px] shadow-none hover:border-input focus-visible:bg-card"
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        value={row.description}
                        onChange={(event) =>
                          updateField(row.key, "description", event.target.value)
                        }
                        placeholder="Transaction description"
                        aria-label={`Description for row ${index + 1}`}
                        className="h-8 border-transparent bg-transparent px-1.5 text-[11.5px] shadow-none hover:border-input focus-visible:bg-card"
                      />
                      {row.reviewReasons.length ? (
                        <p className="mt-1 flex items-start gap-1 pl-1.5 text-[9.5px] leading-4 text-amber-700">
                          <AlertTriangle className="mt-0.5 size-2.5 shrink-0" />
                          {row.reviewReasons.join(" · ")}
                        </p>
                      ) : rowIncomplete ? (
                        <p className="mt-1 flex items-center gap-1 pl-1.5 text-[9.5px] text-amber-700">
                          <AlertTriangle className="size-2.5" />
                          Incomplete row
                        </p>
                      ) : row.edited ? (
                        <p className="mt-1 pl-1.5 text-[9px] tracking-[0.02em] text-muted-foreground">
                          Edited
                        </p>
                      ) : row.source === "manual" ? (
                        <p className="mt-1 pl-1.5 text-[9px] tracking-[0.02em] text-muted-foreground">
                          Manual
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        value={row.reference}
                        onChange={(event) =>
                          updateField(row.key, "reference", event.target.value)
                        }
                        placeholder="Optional"
                        aria-label={`Reference for row ${index + 1}`}
                        className="h-8 border-transparent bg-transparent px-1.5 text-[10.5px] shadow-none hover:border-input focus-visible:bg-card"
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        value={row.currency}
                        onChange={(event) =>
                          updateField(row.key, "currency", event.target.value)
                        }
                        placeholder={statement.currency ?? "GBP"}
                        maxLength={3}
                        aria-label={`Currency for row ${index + 1}`}
                        className="h-8 border-transparent bg-transparent px-1.5 text-[10.5px] uppercase shadow-none hover:border-input focus-visible:bg-card"
                      />
                    </TableCell>
                    {(["debit", "credit", "balance"] as const).map((field) => (
                      <TableCell key={field} className="py-1.5">
                        <Input
                          value={row[field]}
                          onChange={(event) =>
                            updateField(row.key, field, event.target.value)
                          }
                          placeholder="0.00"
                          inputMode="decimal"
                          aria-label={`${field[0].toUpperCase()}${field.slice(1)} for row ${index + 1}`}
                          className="h-8 border-transparent bg-transparent px-1.5 text-right text-[11.5px] tabular-nums shadow-none hover:border-input focus-visible:bg-card"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="py-1.5 pr-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeRow(row)}
                        aria-label={`Remove row ${index + 1}`}
                        className="text-muted-foreground/60 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter className="bg-[#fafcfb]">
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="pl-4 text-[10.5px] font-medium tracking-[0.02em] text-muted-foreground"
                >
                  Draft totals · {pluralize(rows.length, "row")}
                  {deletedIds.size ? ` · ${deletedIds.size} removed` : ""}
                </TableCell>
                <TableCell className="text-right text-[11.5px] font-semibold tabular-nums text-rose-700">
                  {formatMoney(live.totalDebits, statement.currency)}
                </TableCell>
                <TableCell className="text-right text-[11.5px] font-semibold tabular-nums text-emerald-700">
                  {formatMoney(live.totalCredits, statement.currency)}
                </TableCell>
                <TableCell className="text-right text-[11.5px] font-semibold tabular-nums text-foreground">
                  {live.computedClosing === null
                    ? "—"
                    : formatMoney(live.computedClosing, statement.currency)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <AlertCircle className="size-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            No rows are saved for this statement
          </p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-muted-foreground">
            Add a transaction manually if extraction failed or the statement has
            no rows. Nothing is invented automatically.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={addRow}>
            <Plus />
            Add first row
          </Button>
        </CardContent>
      )}

      <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus />
            Add row
          </Button>
          {hasChanges ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
              <span className="size-1.5 rounded-full bg-amber-500" />
              {pluralize(unsavedCount, "unsaved change")}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              All saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          {hasChanges ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetChanges}
              disabled={saving}
            >
              <RotateCcw />
              Discard
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => void saveChanges()}
            disabled={saving || !hasChanges}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
