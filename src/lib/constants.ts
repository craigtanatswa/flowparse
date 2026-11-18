export type AppStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "completed"
  | "partial"
  | "failed";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_MB = 25;
export const MAX_FILES_PER_UPLOAD = 10;
export const STATEMENTS_BUCKET = "statements";

export const statementStatus: Record<
  AppStatus,
  {
    label: string;
    shortLabel: string;
    description: string;
    tone: "neutral" | "info" | "success" | "warning" | "danger";
  }
> = {
  uploaded: {
    label: "Uploaded",
    shortLabel: "Uploaded",
    description: "The file is uploaded but extraction has not started yet.",
    tone: "neutral",
  },
  queued: {
    label: "Queued",
    shortLabel: "Queued",
    description: "Waiting for the processing service.",
    tone: "info",
  },
  processing: {
    label: "Processing",
    shortLabel: "Processing",
    description: "Reading the PDF, extracting rows and checking balances.",
    tone: "info",
  },
  completed: {
    label: "Extracted",
    shortLabel: "Complete",
    description:
      "All rows were extracted. Check the reconciliation status before exporting.",
    tone: "success",
  },
  partial: {
    label: "Needs review",
    shortLabel: "Review",
    description: "Rows were extracted, but some values need your attention.",
    tone: "warning",
  },
  failed: {
    label: "Failed",
    shortLabel: "Failed",
    description: "No reliable transactions could be extracted.",
    tone: "danger",
  },
};

export const validationStatusLabels: Record<string, string> = {
  verified: "Reconciled",
  mismatch: "Balance mismatch",
  insufficient_data: "Not verifiable",
};
