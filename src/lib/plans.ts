import { MAX_FILES_PER_UPLOAD, MAX_FILE_MB } from "@/lib/constants";

export const FREE_PLAN = {
  id: "free",
  name: "Free",
  price: "£0",
  cadence: "forever",
  statementLimit: 25,
  batchLimit: MAX_FILES_PER_UPLOAD,
  fileSizeMb: MAX_FILE_MB,
  description:
    "Everything you need to convert and review statements, with a monthly statement allowance.",
} as const;

export function currentMonthStartIso(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  ).toISOString();
}

export function nextAllowanceReset(now = new Date()): string {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(next);
}

export function planLimitReached(monthlyStatements: number): boolean {
  return monthlyStatements >= FREE_PLAN.statementLimit;
}
