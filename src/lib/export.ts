import "server-only";

import ExcelJS from "exceljs";

import { statementStatus, validationStatusLabels } from "@/lib/constants";
import {
  readReport,
  readStatus,
  readValidation,
  type StatementRecord,
  type TransactionRecord,
} from "@/lib/domain";
import { formatAmount, formatDateTime, formatPeriod } from "@/lib/utils";

function csvCell(value: string): string {
  // Neutralise spreadsheet formula injection for free-text values.
  const safe = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvNumber(value: number | null): string {
  return value === null || value === undefined ? "" : formatAmount(value);
}

export function buildStatementCsv(
  statement: StatementRecord,
  transactions: TransactionRecord[]
): string {
  const currency = statement.currency ?? "";
  const lines = [
    ["Date", "Value date", "Description", "Reference", "Debit", "Credit", "Balance", "Currency"]
      .map(csvCell)
      .join(","),
    ...transactions.map((transaction) =>
      [
        csvCell(transaction.txn_date ?? ""),
        csvCell(transaction.value_date ?? ""),
        csvCell(transaction.description),
        csvCell(transaction.reference ?? ""),
        csvNumber(transaction.debit),
        csvNumber(transaction.credit),
        csvNumber(transaction.balance),
        csvCell(transaction.currency ?? currency),
      ].join(",")
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function buildStatementWorkbook(
  statement: StatementRecord,
  transactions: TransactionRecord[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FlowParse";
  workbook.lastModifiedBy = "FlowParse";
  workbook.created = new Date();
  workbook.modified = new Date();

  const validation = readValidation(statement.validation);
  const report = readReport(statement.report);
  const status = readStatus(statement.status);

  const summary = workbook.addWorksheet("Statement", {
    properties: { defaultRowHeight: 20 },
  });
  summary.columns = [
    { width: 30, style: { font: { bold: true, color: { argb: "FF45524D" } } } },
    { width: 64 },
  ];
  summary.mergeCells("A1:B1");
  const title = summary.getCell("A1");
  title.value = "FlowParse statement export";
  title.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2B24" } };
  title.alignment = { vertical: "middle" };
  summary.getRow(1).height = 36;

  const summaryHeader = summary.addRow(["Field", "Value"]);
  summaryHeader.font = { bold: true, size: 10, color: { argb: "FF68756F" } };
  summaryHeader.height = 22;

  const rows: Array<[string, string | number | null]> = [
    ["Source file", statement.file_name],
    ["Bank", statement.bank_name],
    ["Account holder", statement.account_holder],
    [
      "Account number",
      statement.account_number_last4 ? `•••• ${statement.account_number_last4}` : null,
    ],
    ["Statement period", formatPeriod(statement.statement_start, statement.statement_end)],
    ["Currency", statement.currency],
    ["Extraction method", statement.extraction_method],
    ["Pages", statement.page_count],
    ["Processing status", statementStatus[status].label],
    ["Reconciliation", validationStatusLabels[validation.status] ?? validation.status],
    ["Opening balance", validation.opening_balance],
    ["Total credits", validation.total_credits],
    ["Total debits", validation.total_debits],
    ["Net change", validation.net_change],
    ["Computed closing balance", validation.computed_closing_balance],
    ["Statement closing balance", validation.closing_balance],
    ["Difference", validation.difference],
    ["Transactions", transactions.length],
    ["Rows needing review", validation.needs_review_count],
    ["Potential duplicate rows", validation.duplicate_transactions],
    ["Extraction confidence", report.confidence.level],
    ["Unparsed source lines", report.unparsed_count],
    ["Extracted at", statement.processed_at ? formatDateTime(statement.processed_at) : null],
    ["Exported at", formatDateTime(new Date().toISOString())],
  ];

  for (const [label, value] of rows) {
    const row = summary.addRow([label, value ?? "—"]);
    row.getCell(1).font = { bold: true, color: { argb: "FF45524D" } };
    row.getCell(2).alignment = { vertical: "middle", wrapText: true };
    if (label === "Difference" && typeof value === "number") {
      row.getCell(2).font = {
        bold: true,
        color: { argb: Math.abs(value) < 0.005 ? "FF0E7A66" : "FFBD3247" },
      };
    }
  }

  summary.views = [{ state: "frozen", ySplit: 2 }];

  const sheet = workbook.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 19 },
  });
  sheet.columns = [
    { key: "date", width: 13 },
    { key: "value_date", width: 13 },
    { key: "description", width: 52 },
    { key: "reference", width: 21 },
    { key: "debit", width: 16, style: { numFmt: "#,##0.00;[Red]-#,##0.00" } },
    { key: "credit", width: 16, style: { numFmt: "#,##0.00;[Red]-#,##0.00" } },
    { key: "balance", width: 18, style: { numFmt: "#,##0.00;[Red]-#,##0.00" } },
    { key: "currency", width: 11 },
    { key: "review", width: 28 },
  ];

  const header = sheet.addRow([
    "Date",
    "Value date",
    "Description",
    "Reference",
    "Debit",
    "Credit",
    "Balance",
    "Currency",
    "Review notes",
  ]);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E7A66" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF0A5D4E" } },
    };
  });

  for (const transaction of transactions) {
    const row = sheet.addRow([
      transaction.txn_date ? new Date(`${transaction.txn_date}T00:00:00Z`) : null,
      transaction.value_date ? new Date(`${transaction.value_date}T00:00:00Z`) : null,
      transaction.description,
      transaction.reference ?? "",
      transaction.debit,
      transaction.credit,
      transaction.balance,
      transaction.currency ?? statement.currency ?? "",
      Array.isArray(transaction.review_reasons)
        ? transaction.review_reasons
            .filter((reason): reason is string => typeof reason === "string")
            .join("; ")
        : "",
    ]);
    row.getCell(1).numFmt = "yyyy-mm-dd";
    row.getCell(2).numFmt = "yyyy-mm-dd";
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    row.getCell(9).font = transaction.needs_review
      ? { color: { argb: "FF9A6700" } }
      : { color: { argb: "FF68756F" } };
    if (transaction.needs_review) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
      });
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, transactions.length + 1), column: 9 },
  };
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
