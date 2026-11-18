import { z } from "zod";

import { MAX_FILE_BYTES } from "@/lib/constants";
import { normalizeAmountText } from "@/lib/utils";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uploadCreateSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "File name is required.")
    .max(255, "File name is too long.")
    .refine((name) => /\.pdf$/i.test(name), "Only PDF files are supported."),
  fileSize: z
    .number()
    .int()
    .positive("The file is empty.")
    .max(MAX_FILE_BYTES, "The maximum file size is 25 MB."),
});

const nullableAmount = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => normalizeAmountText(value ?? ""))
  .refine((value) => value === null || /^-?\d{1,12}(\.\d{1,2})?$/.test(value), {
    message: "Amounts must be valid numbers with no more than two decimal places.",
  });

const nullableDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => (value ?? "").trim())
  .refine(
    (value) => {
      if (!value) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    { message: "Dates must use YYYY-MM-DD." }
  );

export const transactionUpsertSchema = z
  .object({
    id: z
      .string()
      .optional()
      .nullable()
      .refine((value) => !value || uuidPattern.test(value), "Invalid transaction id."),
    date: nullableDate,
    value_date: nullableDate,
    currency: z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => {
        const cleaned = (value ?? "").trim().toUpperCase();
        return cleaned === "" ? null : cleaned;
      })
      .refine((value) => value === null || /^[A-Z]{3}$/.test(value), {
        message: "Currencies must be three-letter ISO codes.",
      }),
    description: z
      .string()
      .trim()
      .min(1, "Every row needs a description.")
      .max(1000, "Descriptions are limited to 1,000 characters."),
    reference: z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => {
        const cleaned = (value ?? "").trim();
        return cleaned === "" ? null : cleaned.slice(0, 200);
      }),
    debit: nullableAmount,
    credit: nullableAmount,
    balance: nullableAmount,
  })
  .refine((row) => row.debit !== null || row.credit !== null, {
    message: "Every row needs a debit or a credit.",
    path: ["debit"],
  })
  .refine((row) => row.debit === null || row.credit === null, {
    message: "Use either debit or credit for a row, not both.",
    path: ["credit"],
  })
  .refine((row) => row.debit === null || Number(row.debit) >= 0, {
    message: "Debit amounts cannot be negative.",
    path: ["debit"],
  })
  .refine((row) => row.credit === null || Number(row.credit) >= 0, {
    message: "Credit amounts cannot be negative.",
    path: ["credit"],
  });

export const transactionChangesSchema = z.object({
  upserts: z.array(transactionUpsertSchema).max(5000, "Too many rows in one save."),
  deletes: z
    .array(
      z
        .string()
        .refine((value) => uuidPattern.test(value), "Invalid transaction id.")
    )
    .max(5000)
    .default([]),
});

export type TransactionUpsertInput = z.infer<typeof transactionUpsertSchema>;

export function firstZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "The request was invalid.";
  return issue.message;
}
