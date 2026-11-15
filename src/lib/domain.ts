import type { Json, Tables } from "@/lib/database.types";
import type { AppStatus } from "@/lib/constants";

export type StatementRecord = Tables<"uploaded_documents">;
export type TransactionRecord = Tables<"extracted_transactions">;

export type ValidationTone =
  | "pass"
  | "fail"
  | "not_available";

export interface ValidationCheck {
  id: string;
  label: string;
  status: ValidationTone;
  detail: string;
}

export interface ExtractionValidation {
  status: "verified" | "mismatch" | "insufficient_data";
  checks: ValidationCheck[];
  opening_balance: number | null;
  closing_balance: number | null;
  computed_closing_balance: number | null;
  difference: number | null;
  total_debits: number;
  total_credits: number;
  net_change: number;
  transaction_count: number;
  needs_review_count: number;
  running_balance_failures: number;
  incomplete_rows: number;
  duplicate_transactions: number;
}

export interface UnparsedLine {
  page: number;
  text: string;
  reason: string;
}

export interface PageReport {
  page: number;
  method?: string;
  words?: number;
  confidence?: number;
  [key: string]: unknown;
}

export interface ExtractionConfidence {
  level: "high" | "medium" | "low" | null;
  ocr_confidence_threshold: number | null;
  low_confidence_pages: number[];
  duplicate_transactions: number;
}

export interface ExtractionReport {
  page_count: number;
  pages: PageReport[];
  warnings: string[];
  unparsed_lines: UnparsedLine[];
  unparsed_count: number;
  unparsed_lines_truncated: boolean;
  date_order: string | null;
  date_format_assumed: string | null;
  opening_balance_source: string | null;
  closing_balance_source: string | null;
  bank_profile: string | null;
  confidence: ExtractionConfidence;
}

export interface StatementPayload {
  statement: StatementRecord;
  transactions: TransactionRecord[];
}

const emptyValidation: ExtractionValidation = {
  status: "insufficient_data",
  checks: [],
  opening_balance: null,
  closing_balance: null,
  computed_closing_balance: null,
  difference: null,
  total_debits: 0,
  total_credits: 0,
  net_change: 0,
  transaction_count: 0,
  needs_review_count: 0,
  running_balance_failures: 0,
  incomplete_rows: 0,
  duplicate_transactions: 0,
};

const emptyConfidence: ExtractionConfidence = {
  level: null,
  ocr_confidence_threshold: null,
  low_confidence_pages: [],
  duplicate_transactions: 0,
};

const emptyReport: ExtractionReport = {
  page_count: 0,
  pages: [],
  warnings: [],
  unparsed_lines: [],
  unparsed_count: 0,
  unparsed_lines_truncated: false,
  date_order: null,
  date_format_assumed: null,
  opening_balance_source: null,
  closing_balance_source: null,
  bank_profile: null,
  confidence: emptyConfidence,
};

function asRecord(value: Json | unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function readValidation(value: Json): ExtractionValidation {
  const raw = asRecord(value);
  const checks = Array.isArray(raw.checks)
    ? raw.checks
        .map((item) => {
          const check = asRecord(item);
          const status = check.status;
          if (status !== "pass" && status !== "fail" && status !== "not_available") {
            return null;
          }
          return {
            id: asString(check.id),
            label: asString(check.label),
            status,
            detail: asString(check.detail),
          } satisfies ValidationCheck;
        })
        .filter((item): item is ValidationCheck => item !== null)
    : [];

  const status =
    raw.status === "verified" ||
    raw.status === "mismatch" ||
    raw.status === "insufficient_data"
      ? raw.status
      : "insufficient_data";

  return {
    ...emptyValidation,
    status,
    checks,
    opening_balance: asNullableNumber(raw.opening_balance),
    closing_balance: asNullableNumber(raw.closing_balance),
    computed_closing_balance: asNullableNumber(raw.computed_closing_balance),
    difference: asNullableNumber(raw.difference),
    total_debits: asNumber(raw.total_debits),
    total_credits: asNumber(raw.total_credits),
    net_change: asNumber(raw.net_change),
    transaction_count: asNumber(raw.transaction_count),
    needs_review_count: asNumber(raw.needs_review_count),
    running_balance_failures: asNumber(raw.running_balance_failures),
    incomplete_rows: asNumber(raw.incomplete_rows),
    duplicate_transactions: asNumber(raw.duplicate_transactions),
  };
}

export function readReport(value: Json): ExtractionReport {
  const raw = asRecord(value);
  const pages = Array.isArray(raw.pages)
    ? (raw.pages as PageReport[]).filter(
        (page) => page && typeof page === "object" && typeof page.page === "number"
      )
    : [];
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
  const unparsedLines = Array.isArray(raw.unparsed_lines)
    ? raw.unparsed_lines
        .map((item) => {
          const line = asRecord(item);
          return {
            page: asNumber(line.page),
            text: asString(line.text),
            reason: asString(line.reason),
          };
        })
        .filter((line) => Boolean(line.text))
    : [];

  return {
    ...emptyReport,
    page_count: asNumber(raw.page_count),
    pages,
    warnings,
    unparsed_lines: unparsedLines,
    unparsed_count: asNumber(raw.unparsed_count, unparsedLines.length),
    unparsed_lines_truncated:
      raw.unparsed_lines_truncated === true ||
      asNumber(raw.unparsed_count, unparsedLines.length) > unparsedLines.length,
    date_order: typeof raw.date_order === "string" ? raw.date_order : null,
    date_format_assumed:
      typeof raw.date_format_assumed === "string" ? raw.date_format_assumed : null,
    opening_balance_source:
      typeof raw.opening_balance_source === "string"
        ? raw.opening_balance_source
        : null,
    closing_balance_source:
      typeof raw.closing_balance_source === "string"
        ? raw.closing_balance_source
        : null,
    bank_profile: typeof raw.bank_profile === "string" ? raw.bank_profile : null,
    confidence: readConfidence(raw.confidence),
  };
}

function readConfidence(value: unknown): ExtractionConfidence {
  const raw = asRecord(value);
  const level = raw.level;
  const lowPages = Array.isArray(raw.low_confidence_pages)
    ? raw.low_confidence_pages.filter(
        (page): page is number => typeof page === "number" && Number.isFinite(page)
      )
    : [];
  return {
    level:
      level === "high" || level === "medium" || level === "low" ? level : null,
    ocr_confidence_threshold: asNullableNumber(raw.ocr_confidence_threshold),
    low_confidence_pages: lowPages,
    duplicate_transactions: asNumber(raw.duplicate_transactions),
  };
}

export function readReviewReasons(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((reason): reason is string => typeof reason === "string");
}

export function readStatus(value: string): AppStatus {
  if (
    value === "uploaded" ||
    value === "queued" ||
    value === "processing" ||
    value === "completed" ||
    value === "partial" ||
    value === "failed"
  ) {
    return value;
  }
  return "uploaded";
}

export function isProcessingStatus(status: AppStatus): boolean {
  return status === "queued" || status === "processing";
}

export function isTerminalStatus(status: AppStatus): boolean {
  return status === "completed" || status === "partial" || status === "failed";
}

export function displayNameForStatement(
  statement: Pick<StatementRecord, "file_name" | "bank_name">
): string {
  return statement.bank_name
    ? `${statement.bank_name} statement`
    : statement.file_name.replace(/\.pdf$/i, "");
}

/** Compute a live reconciliation from editable table values. */
export interface LiveLedgerRow {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface LiveReconciliation {
  totalDebits: number;
  totalCredits: number;
  netChange: number;
  computedClosing: number | null;
  difference: number | null;
  incompleteRows: number;
}

export function parseAmountOrNull(value: string): number | null {
  const cleaned = value.trim().replace(/[£$€,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeLiveReconciliation(
  rows: LiveLedgerRow[],
  openingBalance: number | null,
  closingBalance: number | null
): LiveReconciliation {
  let totalDebits = 0;
  let totalCredits = 0;
  let incompleteRows = 0;

  for (const row of rows) {
    const debit = parseAmountOrNull(row.debit) ?? 0;
    const credit = parseAmountOrNull(row.credit) ?? 0;
    totalDebits += debit;
    totalCredits += credit;
    if (
      !row.date ||
      !row.description.trim() ||
      (parseAmountOrNull(row.debit) === null && parseAmountOrNull(row.credit) === null)
    ) {
      incompleteRows += 1;
    }
  }

  const netChange = totalCredits - totalDebits;
  const computedClosing =
    openingBalance === null ? null : openingBalance + netChange;
  const difference =
    computedClosing !== null && closingBalance !== null
      ? closingBalance - computedClosing
      : null;

  return {
    totalDebits: roundMoney(totalDebits),
    totalCredits: roundMoney(totalCredits),
    netChange: roundMoney(netChange),
    computedClosing: computedClosing === null ? null : roundMoney(computedClosing),
    difference: difference === null ? null : roundMoney(difference),
    incompleteRows,
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
