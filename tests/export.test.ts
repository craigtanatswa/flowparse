import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  buildStatementCsv,
  buildStatementWorkbook,
} from "@/lib/export";
import type { StatementRecord, TransactionRecord } from "@/lib/domain";

function statement(overrides: Partial<StatementRecord> = {}): StatementRecord {
  return {
    account_holder: "Alex Morgan",
    account_number_last4: "5678",
    bank_name: "Barclays",
    closing_balance: 13500,
    created_at: "2025-02-01T10:00:00.000Z",
    currency: "GBP",
    error_message: null,
    extraction_method: "digital",
    file_name: "barclays january.pdf",
    file_size: 1234,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mime_type: "application/pdf",
    opening_balance: 10000,
    page_count: 1,
    pages_charged_period: "2025-02-01",
    processed_at: "2025-02-01T10:00:01.000Z",
    processing_stage: null,
    progress_percent: 100,
    report: {
      page_count: 1,
      pages: [],
      warnings: [],
      unparsed_lines: [],
      unparsed_count: 0,
      unparsed_lines_truncated: false,
      date_order: "DMY",
      date_format_assumed: null,
      opening_balance_source: "statement",
      closing_balance_source: "statement",
      bank_profile: "barclays",
      confidence: {
        level: "high",
        ocr_confidence_threshold: 65,
        low_confidence_pages: [],
        duplicate_transactions: 0,
      },
    },
    statement_end: "2025-01-31",
    statement_start: "2025-01-01",
    status: "completed",
    storage_path:
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/original.pdf",
    updated_at: "2025-02-01T10:00:01.000Z",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    validation: {
      status: "verified",
      checks: [],
      opening_balance: 10000,
      closing_balance: 13500,
      computed_closing_balance: 13500,
      difference: 0,
      total_debits: 0,
      total_credits: 3500,
      net_change: 3500,
      transaction_count: 1,
      needs_review_count: 0,
      running_balance_failures: 0,
      incomplete_rows: 0,
      duplicate_transactions: 0,
    },
    validation_status: "verified",
    ...overrides,
  };
}

function transaction(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    balance: 13500,
    created_at: "2025-02-01T10:00:01.000Z",
    credit: 3500,
    currency: "GBP",
    debit: null,
    description: "ACME PAYROLL",
    document_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    edited: false,
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    job_id: null,
    needs_review: false,
    page_number: 1,
    raw_text: "02/01/2025 ACME PAYROLL 3,500.00 13,500.00",
    reference: "PAY-001",
    review_reasons: [],
    sort_index: 0,
    source: "extracted",
    txn_date: "2025-01-02",
    updated_at: "2025-02-01T10:00:01.000Z",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    value_date: "2025-01-03",
    ...overrides,
  };
}

describe("CSV export", () => {
  it("writes a stable header, ISO dates and dot-decimal amounts", () => {
    const csv = buildStatementCsv(statement(), [transaction()]);
    const lines = csv.replace(/^\uFEFF/, "").split("\r\n").filter(Boolean);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toBe(
      '"Date","Value date","Description","Reference","Debit","Credit","Balance","Currency"'
    );
    expect(lines[1]).toBe(
      '"2025-01-02","2025-01-03","ACME PAYROLL","PAY-001",,3500.00,13500.00,"GBP"'
    );
  });

  it("keeps negative balances and per-row currencies", () => {
    const csv = buildStatementCsv(statement({ currency: "EUR" }), [
      transaction({
        credit: null,
        debit: 120.5,
        balance: -320.5,
        currency: "USD",
        description: "US SUPPLIER",
      }),
    ]);
    const line = csv.replace(/^\uFEFF/, "").split("\r\n")[1];

    expect(line).toContain('120.50,,-320.50,"USD"');
  });

  it("neutralises spreadsheet formula injection in free text", () => {
    const csv = buildStatementCsv(statement(), [
      transaction({
        description: "=cmd|' /C calc'!A0",
        reference: "+SUM(A1:A2)",
      }),
    ]);

    expect(csv).toContain(
      '"\'=cmd|\' /C calc\'!A0","\'+SUM(A1:A2)"'
    );
  });

  it("exports an empty statement as a header-only file", () => {
    const csv = buildStatementCsv(statement(), []);
    const lines = csv.replace(/^\uFEFF/, "").split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1);
  });
});

describe("XLSX export", () => {
  it("formats summary values, numeric amounts and date cells", async () => {
    const buffer = await buildStatementWorkbook(statement(), [
      transaction(),
      transaction({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        sort_index: 1,
        description: "TESCO",
        reference: null,
        credit: null,
        debit: 82.35,
        balance: 13417.65,
        txn_date: "2025-01-03",
        value_date: null,
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Statement",
      "Transactions",
    ]);

    const transactions = workbook.getWorksheet("Transactions");
    expect(transactions).toBeDefined();
    const first = transactions!.getRow(2);
    expect(first.getCell(1).value).toBeInstanceOf(Date);
    expect((first.getCell(1).value as Date).toISOString().slice(0, 10)).toBe(
      "2025-01-02"
    );
    expect(first.getCell(2).value).toBeInstanceOf(Date);
    expect((first.getCell(2).value as Date).toISOString().slice(0, 10)).toBe(
      "2025-01-03"
    );
    expect(first.getCell(3).value).toBe("ACME PAYROLL");
    expect(first.getCell(5).value).toBeNull();
    expect(first.getCell(6).value).toBe(3500);
    expect(first.getCell(7).value).toBe(13500);
    expect(first.getCell(8).value).toBe("GBP");

    const summary = workbook.getWorksheet("Statement");
    expect(summary).toBeDefined();
    const rows: Array<[string, unknown]> = [];
    summary!.eachRow((row) => {
      rows.push([String(row.getCell(1).value ?? ""), row.getCell(2).value]);
    });
    const difference = rows.find(([label]) => label === "Difference");
    expect(difference?.[1]).toBe(0);
    const totalCredits = rows.find(([label]) => label === "Total credits");
    expect(totalCredits?.[1]).toBe(3500);
    const totalDebits = rows.find(([label]) => label === "Total debits");
    expect(totalDebits?.[1]).toBe(0);
  });

  it("stores formula-like descriptions as plain strings, not formulas", async () => {
    const buffer = await buildStatementWorkbook(statement(), [
      transaction({ description: "=HYPERLINK(\"http://example.test\")" }),
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const cell = workbook.getWorksheet("Transactions")!.getRow(2).getCell(3);

    expect(cell.value).toBe('=HYPERLINK("http://example.test")');
    expect(cell.formula).toBeUndefined();
  });

  it("highlights rows that need review", async () => {
    const buffer = await buildStatementWorkbook(statement(), [
      transaction({
        needs_review: true,
        review_reasons: ["Potential duplicate of row 1"],
      }),
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const row = workbook.getWorksheet("Transactions")!.getRow(2);

    expect(row.getCell(9).value).toBe("Potential duplicate of row 1");
    expect(row.getCell(9).font?.color?.argb).toBe("FF9A6700");
  });
});
