import { describe, expect, it } from "vitest";

import {
  billingGrantsAccess,
  resolveEntitledPlan,
} from "@/lib/billing";
import {
  computeLiveReconciliation,
  parseAmountOrNull,
  type LiveLedgerRow,
} from "@/lib/domain";
import {
  currentMonthStartDate,
  nextAllowanceReset,
  planLimitReached,
  FALLBACK_ACCOUNT_PLAN,
} from "@/lib/plans";
import { safeNextPath, parseAmountInput } from "@/lib/utils";
import {
  transactionChangesSchema,
  transactionUpsertSchema,
  uploadCreateSchema,
} from "@/lib/validation";

describe("live reconciliation", () => {
  const rows: LiveLedgerRow[] = [
    {
      date: "2025-01-02",
      description: "SALARY",
      debit: "",
      credit: "1,500.00",
      balance: "2,500.00",
    },
    {
      date: "2025-01-03",
      description: "RENT",
      debit: "800.00",
      credit: "",
      balance: "1,700.00",
    },
  ];

  it("separates debits and credits and computes the closing difference", () => {
    const live = computeLiveReconciliation(rows, 1000, 1700);

    expect(live.totalCredits).toBe(1500);
    expect(live.totalDebits).toBe(800);
    expect(live.netChange).toBe(700);
    expect(live.computedClosing).toBe(1700);
    expect(live.difference).toBe(0);
    expect(live.incompleteRows).toBe(0);
  });

  it("counts rows missing a date, description or amount", () => {
    const live = computeLiveReconciliation(
      [
        { date: "", description: "SALARY", debit: "", credit: "10.00", balance: "" },
        { date: "2025-01-03", description: "", debit: "2.00", credit: "", balance: "" },
        { date: "2025-01-04", description: "NO AMOUNT", debit: "", credit: "", balance: "" },
      ],
      0,
      8
    );

    expect(live.incompleteRows).toBe(3);
  });

  it("supports negative balances and a negative net change", () => {
    const live = computeLiveReconciliation(
      [
        {
          date: "2025-01-02",
          description: "CARD",
          debit: "100.00",
          credit: "",
          balance: "-350.00",
        },
      ],
      -250,
      -350
    );

    expect(live.totalDebits).toBe(100);
    expect(live.netChange).toBe(-100);
    expect(live.computedClosing).toBe(-350);
    expect(live.difference).toBe(0);
  });

  it("treats comma-grouped numbers as money and blank cells as null", () => {
    expect(parseAmountOrNull("1,234.56")).toBe(1234.56);
    expect(parseAmountOrNull("1.234,56")).toBe(1234.56);
    expect(parseAmountOrNull("1 234,56")).toBe(1234.56);
    expect(parseAmountOrNull("-82.35")).toBe(-82.35);
    expect(parseAmountOrNull("(82.35)")).toBe(-82.35);
    expect(parseAmountOrNull("£12.00")).toBe(12);
    expect(parseAmountOrNull("")).toBeNull();
    expect(parseAmountOrNull("not money")).toBeNull();
    expect(parseAmountOrNull("1.234")).toBeNull();
  });
});

describe("usage limits", () => {
  it("uses the plan page limit and treats unlimited plans as uncapped", () => {
    expect(planLimitReached(0)).toBe(false);
    expect(planLimitReached(2)).toBe(false);
    expect(planLimitReached(3)).toBe(true);
    expect(planLimitReached(100)).toBe(true);
    expect(
      planLimitReached(100, { ...FALLBACK_ACCOUNT_PLAN, unlimited: true, pageLimit: null })
    ).toBe(false);
  });

  it("uses UTC calendar months", () => {
    expect(currentMonthStartDate(new Date("2025-01-31T23:59:59Z"))).toBe("2025-01-01");
    expect(currentMonthStartDate(new Date("2025-02-01T00:00:00Z"))).toBe("2025-02-01");
    expect(nextAllowanceReset(new Date("2025-02-01T00:00:00Z"))).toBe("1 March 2025");
  });
});

describe("billing entitlement", () => {
  const now = new Date("2025-02-01T00:00:00Z");

  it("grants access for active and past-due subscriptions", () => {
    expect(
      resolveEntitledPlan({ paidPlan: "pro", status: "active", now })
    ).toBe("pro");
    expect(
      resolveEntitledPlan({ paidPlan: "pro", status: "past_due", now })
    ).toBe("pro");
  });

  it("keeps a cancelled subscription until its paid period ends", () => {
    const input = {
      paidPlan: "starter" as const,
      status: "cancelled",
      cancelAtNextBillingDate: true,
      currentPeriodEnd: "2025-02-15T00:00:00Z",
      now,
    };
    expect(resolveEntitledPlan(input)).toBe("starter");
    expect(billingGrantsAccess({ ...input, planId: "starter" })).toBe(true);
    expect(
      resolveEntitledPlan({
        ...input,
        now: new Date("2025-02-15T00:00:00Z"),
      })
    ).toBe("free");
  });

  it("falls back to Free for unpaid or terminal states", () => {
    for (const status of ["pending", "failed", "on_hold", "paused", "expired"]) {
      expect(resolveEntitledPlan({ paidPlan: "business", status, now })).toBe("free");
    }
    expect(resolveEntitledPlan({ paidPlan: null, status: "active", now })).toBe("free");
  });
});

describe("transaction validation", () => {
  const valid = {
    date: "2025-01-02",
    value_date: "2025-01-03",
    description: "ACME PAYROLL",
    reference: "PAY-001",
    debit: "",
    credit: "3500.00",
    balance: "13500.00",
    currency: "gbp",
  };

  it("accepts a complete row and normalises the currency", () => {
    const parsed = transactionUpsertSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.credit).toBe("3500.00");
      expect(parsed.data.debit).toBeNull();
      expect(parsed.data.currency).toBe("GBP");
    }
  });

  it("normalises European and grouped amounts before saving", () => {
    const european = transactionUpsertSchema.safeParse({
      ...valid,
      credit: "1.234,56",
      balance: "1 234,56",
    });
    expect(european.success).toBe(true);
    if (european.success) {
      expect(european.data.credit).toBe("1234.56");
      expect(european.data.balance).toBe("1234.56");
    }

    const parenthesised = transactionUpsertSchema.safeParse({
      ...valid,
      debit: "(82.35)",
      credit: "",
    });
    expect(parenthesised.success).toBe(false);
  });

  it("rejects negative, dual-sided and over-precise amounts", () => {
    expect(
      transactionUpsertSchema.safeParse({ ...valid, debit: "-10.00", credit: "" }).success
    ).toBe(false);
    expect(
      transactionUpsertSchema.safeParse({ ...valid, debit: "10.00", credit: "10.00" }).success
    ).toBe(false);
    expect(
      transactionUpsertSchema.safeParse({ ...valid, credit: "10.001" }).success
    ).toBe(false);
  });

  it("rejects invalid dates and currencies", () => {
    expect(
      transactionUpsertSchema.safeParse({ ...valid, date: "2025-02-30" }).success
    ).toBe(false);
    expect(
      transactionUpsertSchema.safeParse({ ...valid, date: "02/01/2025" }).success
    ).toBe(false);
    expect(
      transactionUpsertSchema.safeParse({ ...valid, currency: "EURO" }).success
    ).toBe(false);
  });

  it("requires a debit or credit and a description", () => {
    expect(
      transactionUpsertSchema.safeParse({ ...valid, debit: "", credit: "" }).success
    ).toBe(false);
    expect(
      transactionUpsertSchema.safeParse({ ...valid, description: "" }).success
    ).toBe(false);
  });

  it("rejects an over-sized save", () => {
    const rows = Array.from({ length: 5001 }, () => valid);
    expect(
      transactionChangesSchema.safeParse({ upserts: rows, deletes: [] }).success
    ).toBe(false);
  });
});

describe("upload validation", () => {
  it("accepts a PDF name and a positive size", () => {
    expect(
      uploadCreateSchema.safeParse({ fileName: "statement.pdf", fileSize: 1024 }).success
    ).toBe(true);
  });

  it("rejects non-PDF names, empty files and files over 25 MB", () => {
    expect(
      uploadCreateSchema.safeParse({ fileName: "statement.txt", fileSize: 1024 }).success
    ).toBe(false);
    expect(
      uploadCreateSchema.safeParse({ fileName: "statement.pdf", fileSize: 0 }).success
    ).toBe(false);
    expect(
      uploadCreateSchema.safeParse({
        fileName: "statement.pdf",
        fileSize: 25 * 1024 * 1024 + 1,
      }).success
    ).toBe(false);
  });
});

describe("utility guards", () => {
  it("blocks protocol-relative and external post-login redirects", () => {
    expect(safeNextPath("/statements/abc")).toBe("/statements/abc");
    expect(safeNextPath("//evil.test")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.test")).toBe("/dashboard");
    expect(safeNextPath("https://evil.test")).toBe("/dashboard");
    expect(safeNextPath("/login")).toBe("/dashboard");
  });

  it("rejects amounts with more than two decimal places in the editor", () => {
    expect(parseAmountInput("1,234.56")).toBe(1234.56);
    expect(parseAmountInput("1.234,56")).toBe(1234.56);
    expect(parseAmountInput("₹1,23,456.78")).toBe(123456.78);
    expect(parseAmountInput("A$1,234.56")).toBe(1234.56);
    expect(parseAmountInput("12.345")).toBeNull();
    expect(parseAmountInput("-82.35")).toBe(-82.35);
    expect(parseAmountInput("(82.35)")).toBe(-82.35);
  });
});
