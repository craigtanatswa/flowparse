import Link from "next/link";
import { ArrowLeft, BadgeCheck, FileSpreadsheet, LockKeyhole, ScanLine } from "lucide-react";

import { Logo, LogoGlyph } from "@/components/brand/logo";

export function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-[#f7faf8] lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 marketing-grid opacity-40" />
        <div className="pointer-events-none absolute -right-24 top-1/4 size-[380px] rounded-full bg-emerald-100/50 blur-3xl" />
        <LogoGlyph className="pointer-events-none absolute -bottom-16 -right-16 size-[360px] opacity-[0.045]" />

        <div className="relative">
          <Logo href="/" imageClassName="h-8" />
        </div>

        <div className="relative max-w-md">
          <p className="mb-5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.01em] text-primary">
            <span className="h-px w-7 bg-primary/30" />
            Financial document workflow
          </p>
          <h2 className="text-[34px] font-semibold leading-[1.12] tracking-[-0.04em] text-foreground">
            Close the month without retyping a single transaction.
          </h2>
          <p className="mt-5 text-[13px] leading-7 text-muted-foreground">
            FlowParse turns bank statement PDFs into structured, reconciled
            spreadsheets — with a review step you actually control.
          </p>

          <div className="mt-9 space-y-2.5">
            {[
              { icon: ScanLine, text: "Digital PDFs and scanned statements" },
              { icon: BadgeCheck, text: "Balance and running-total checks" },
              { icon: LockKeyhole, text: "Private, per-user document storage" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-3 text-[12px] text-foreground/75 shadow-[0_1px_2px_rgba(16,28,24,0.03)]"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-accent text-primary">
                  <item.icon className="size-3" />
                </span>
                {item.text}
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-2 text-[11px] text-muted-foreground">
            <FileSpreadsheet className="size-3.5 text-primary" />
            Excel and CSV exports, ready for your ledger.
          </div>
        </div>

        <div className="relative flex items-center justify-between text-[10.5px] tracking-[0.02em] text-muted-foreground">
          <span>Private by default</span>
          <span>Built for finance teams</span>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col bg-white">
        <div className="flex items-center justify-between px-5 py-5 lg:hidden">
          <Logo imageClassName="h-6" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">
            <Link
              href="/"
              className="mb-8 hidden items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground lg:inline-flex"
            >
              <ArrowLeft className="size-3.5" />
              Back to home
            </Link>
            {children}
            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </div>

        <div className="px-5 py-5 text-center text-[10.5px] tracking-[0.02em] text-muted-foreground">
          Private by default · Your documents stay yours
        </div>
      </main>
    </div>
  );
}
