import {
  AlertTriangle,
  ChevronDown,
  FileSearch,
  ScanLine,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { StatementRecord } from "@/lib/domain";
import { readReport } from "@/lib/domain";

export function ExtractionReportPanel({
  statement,
}: {
  statement: StatementRecord;
}) {
  const report = readReport(statement.report);
  const warningCount = report.warnings.length;
  const unparsedCount = report.unparsed_count;
  const lowConfidence = report.confidence.level === "low";
  const needsReview =
    warningCount > 0 ||
    unparsedCount > 0 ||
    report.confidence.duplicate_transactions > 0 ||
    report.confidence.low_confidence_pages.length > 0;
  const hasReport =
    report.page_count > 0 || warningCount > 0 || unparsedCount > 0;

  return (
    <details className="group overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(20,32,28,0.03)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-primary ring-1 ring-border/60">
            <FileSearch className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground">
              Extraction report
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {hasReport
                ? `${report.page_count || "—"} page(s) · ${warningCount} warning(s) · ${unparsedCount} unparsed line(s)`
                : "No report details are available yet"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {report.confidence.level ? (
            <Badge
              variant={
                lowConfidence
                  ? "danger"
                  : report.confidence.level === "medium"
                    ? "warning"
                    : "success"
              }
            >
              {report.confidence.level === "high"
                ? "High confidence"
                : report.confidence.level === "medium"
                  ? "Medium confidence"
                  : "Low confidence"}
            </Badge>
          ) : null}
          {needsReview ? (
            <Badge variant="warning">
              <AlertTriangle />
              Review report
            </Badge>
          ) : hasReport ? (
            <Badge variant="success">Clean read</Badge>
          ) : null}
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-border/70 px-5 py-5">
        {!hasReport ? (
          <p className="text-[12px] text-muted-foreground">
            The extraction report will appear here after processing.
          </p>
        ) : (
          <div className="space-y-5">
            {report.confidence.duplicate_transactions > 0 ||
            report.confidence.low_confidence_pages.length > 0 ||
            unparsedCount > report.unparsed_lines.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {report.confidence.low_confidence_pages.length ? (
                  <div className="rounded-lg border border-rose-200/70 bg-rose-50/50 px-3 py-2 text-[11.5px] leading-5 text-rose-950">
                    OCR confidence was below{" "}
                    {report.confidence.ocr_confidence_threshold ?? 65}% on page(s){" "}
                    {report.confidence.low_confidence_pages.join(", ")}. Verify those rows.
                  </div>
                ) : null}
                {report.confidence.duplicate_transactions > 0 ? (
                  <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-[11.5px] leading-5 text-amber-950">
                    {report.confidence.duplicate_transactions} potential duplicate row(s)
                    were kept and flagged for review. Nothing was removed.
                  </div>
                ) : null}
                {unparsedCount > report.unparsed_lines.length ? (
                  <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-[11.5px] leading-5 text-amber-950">
                    Showing the first {report.unparsed_lines.length} of {unparsedCount}{" "}
                    unparsed lines. The full count is preserved in the report.
                  </div>
                ) : null}
              </div>
            ) : null}
            {report.pages.length ? (
              <div>
                <p className="mb-2 text-[10.5px] font-medium tracking-[0.01em] text-muted-foreground">
                  Pages
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {report.pages.map((page) => {
                    const confidence =
                      typeof page.ocr_confidence === "number"
                        ? ` · ${Math.round(page.ocr_confidence)}% OCR`
                        : "";
                    const transactions =
                      typeof page.transactions === "number"
                        ? ` · ${page.transactions} rows`
                        : "";
                    return (
                      <span
                        key={page.page}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-[#fafcfb] px-2.5 py-1.5 text-[10.5px] text-muted-foreground"
                      >
                        <ScanLine className="size-3 text-primary/70" />
                        Page {page.page}
                        {page.method ? (
                          <span className="tracking-[0.02em]">
                            {page.method}
                          </span>
                        ) : null}
                        {confidence}
                        {transactions}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {report.warnings.length ? (
              <div>
                <p className="mb-2 text-[10.5px] font-medium tracking-[0.01em] text-muted-foreground">
                  Warnings
                </p>
                <ul className="space-y-1.5">
                  {report.warnings.map((warning, index) => (
                    <li
                      key={`${warning}-${index}`}
                      className="flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-[11.5px] leading-5 text-amber-950"
                    >
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {report.unparsed_lines.length ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10.5px] font-medium tracking-[0.01em] text-muted-foreground">
                    Lines not turned into rows
                  </p>
                  <span className="text-[10.5px] text-muted-foreground">
                    Kept here so nothing disappears silently
                  </span>
                </div>
                <ul className="thin-scrollbar max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border/80 bg-[#fafcfb] p-2">
                  {report.unparsed_lines.map((line, index) => (
                    <li
                      key={`${line.page}-${index}`}
                      className="rounded-lg px-2.5 py-2 hover:bg-white/80"
                    >
                      <div className="flex items-center gap-2 text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
                        <span>Page {line.page || "—"}</span>
                        <span className="text-border">/</span>
                        <span className="normal-case tracking-normal text-amber-700">
                          {line.reason}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words font-mono text-[10.5px] leading-5 text-foreground/75">
                        {line.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {report.date_format_assumed ? (
              <p className="text-[10.5px] leading-5 text-muted-foreground">
                Dates were ambiguous and interpreted as{" "}
                <span className="font-medium text-foreground">
                  {report.date_format_assumed}
                </span>
                . Check a few rows if the statement uses a different convention.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </details>
  );
}
