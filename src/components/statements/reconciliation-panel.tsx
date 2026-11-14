import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  MinusCircle,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { validationStatusLabels } from "@/lib/constants";
import {
  readValidation,
  type StatementRecord,
} from "@/lib/domain";
import { cn, formatMoney } from "@/lib/utils";

const title = {
  verified: "Balances reconcile",
  mismatch: "Balances need attention",
  insufficient_data: "Not enough data to verify",
} as const;

const badgeVariant = {
  verified: "success",
  mismatch: "danger",
  insufficient_data: "warning",
} as const;

export function ReconciliationPanel({
  statement,
}: {
  statement: StatementRecord;
}) {
  const validation = readValidation(statement.validation);
  const currency = statement.currency;
  const hasChecks = validation.checks.length > 0;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/70">
        <div>
          <CardTitle>Reconciliation</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Opening balance + credits − debits, checked against the statement.
          </p>
        </div>
        <Badge variant={badgeVariant[validation.status]} size="lg" className="shrink-0">
          {validation.status === "verified" ? (
            <ShieldCheck />
          ) : validation.status === "mismatch" ? (
            <AlertTriangle />
          ) : (
            <CircleHelp />
          )}
          {validationStatusLabels[validation.status]}
        </Badge>
      </CardHeader>

      <CardContent className="pt-5">
        {hasChecks ? (
          <>
            <div className="mb-5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <p className="text-[12px] font-semibold text-foreground">
                {title[validation.status]}
              </p>
              <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                {validation.status === "verified"
                  ? "The extracted ledger agrees with the statement balances and the running balance column."
                  : validation.status === "mismatch"
                    ? "The totals do not line up with the statement endpoints. Check any highlighted rows or missing transactions."
                    : "The statement did not include both opening and closing balances, so the endpoint check cannot run."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border/80 bg-border/70">
              <div className="bg-card px-3 py-3">
                <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
                  Money in
                </p>
                <p className="mt-1.5 text-[13px] font-semibold tabular-nums text-emerald-700">
                  {formatMoney(validation.total_credits, currency)}
                </p>
              </div>
              <div className="bg-card px-3 py-3">
                <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
                  Money out
                </p>
                <p className="mt-1.5 text-[13px] font-semibold tabular-nums text-rose-700">
                  {formatMoney(validation.total_debits, currency)}
                </p>
              </div>
              <div className="bg-card px-3 py-3">
                <p className="text-[9.5px] font-medium tracking-[0.02em] text-muted-foreground">
                  Difference
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-[13px] font-semibold tabular-nums",
                    validation.difference === 0
                      ? "text-emerald-700"
                      : "text-foreground"
                  )}
                >
                  {validation.difference === null
                    ? "—"
                    : formatMoney(validation.difference, currency)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-0.5">
              {validation.checks.map((check) => {
                const Icon =
                  check.status === "pass"
                    ? CheckCircle2
                    : check.status === "fail"
                      ? AlertTriangle
                      : MinusCircle;
                return (
                  <div
                    key={check.id}
                    className="flex items-start gap-2.5 rounded-lg px-1 py-2"
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        check.status === "pass"
                          ? "text-emerald-600"
                          : check.status === "fail"
                            ? "text-rose-600"
                            : "text-muted-foreground"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-medium leading-4 text-foreground">
                        {check.label}
                      </p>
                      <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">
                        {check.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-start justify-between gap-4 border-t border-border/70 pt-3 text-[10.5px] text-muted-foreground">
              <span>
                {validation.opening_balance !== null
                  ? `Opening ${formatMoney(validation.opening_balance, currency)}`
                  : "Opening balance not detected"}
                {" → "}
                {validation.computed_closing_balance !== null
                  ? `Computed closing ${formatMoney(validation.computed_closing_balance, currency)}`
                  : "Closing not computable"}
              </span>
              {validation.needs_review_count > 0 ? (
                <span className="shrink-0 font-medium text-amber-700">
                  {validation.needs_review_count} to review
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-[12px] leading-6 text-muted-foreground">
            {statement.status === "queued" || statement.status === "processing"
              ? "Reconciliation checks will appear when extraction finishes."
              : "No reconciliation checks are available for this statement yet."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
