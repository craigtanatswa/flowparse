import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(
  value: number | string | null | undefined,
  currency?: string | null,
  options?: { showSymbol?: boolean }
): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "—";

  if (currency && /^[A-Z]{3}$/.test(currency) && options?.showSymbol !== false) {
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // Fall through to a plain number for an unsupported currency code.
    }
  }
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "";
  return amount.toFixed(2);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "Period not detected";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start || end);
}

export function formatCurrencyLabel(currency: string | null | undefined): string {
  if (!currency) return "Statement";
  return `${currency} statement`;
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function initials(email: string | null | undefined): string {
  if (!email) return "FP";
  const name = email.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, " ") || "";
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return email.slice(0, 2).toUpperCase();
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

export function fileStem(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").slice(0, 120);
}

export function safeDownloadName(name: string, suffix: string): string {
  const base = name
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "statement"}-${suffix}`;
}

/** Only allow same-origin relative paths, never protocol-relative or external URLs. */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  if (value.startsWith("/login") || value.startsWith("/signup") || value.startsWith("/auth/")) {
    return fallback;
  }
  return value;
}

export function isUuid(value: string | null | undefined): boolean {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/[£$€,\s]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return null;
  return value;
}

export function parseAmountFields(row: {
  debit: string;
  credit: string;
  balance: string;
}): { debit: number | null; credit: number | null; balance: number | null } {
  return {
    debit: parseAmountInput(row.debit),
    credit: parseAmountInput(row.credit),
    balance: parseAmountInput(row.balance),
  };
}
