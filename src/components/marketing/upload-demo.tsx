"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileSpreadsheet,
  FileText,
  ScanLine,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { MAX_FILE_MB } from "@/lib/constants";
import { cn, formatFileSize } from "@/lib/utils";

interface DemoFile {
  name: string;
  size: number;
}

async function isPdf(file: File): Promise<boolean> {
  try {
    const header = await file.slice(0, 1024).arrayBuffer();
    return new TextDecoder("latin1").decode(header).includes("%PDF-");
  } catch {
    return false;
  }
}

export function UploadDemo({ signedIn }: { signedIn: boolean }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<DemoFile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  async function choose(candidate: File | undefined) {
    if (!candidate) return;
    setError(null);

    if (!candidate.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF bank statement.");
      return;
    }
    if (candidate.size <= 0) {
      setError("That file is empty.");
      return;
    }
    if (candidate.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Statements must be smaller than ${MAX_FILE_MB} MB.`);
      return;
    }

    setChecking(true);
    const validPdf = await isPdf(candidate);
    setChecking(false);
    if (!validPdf) {
      setError("That file does not look like a valid PDF.");
      return;
    }

    setFile({ name: candidate.name, size: candidate.size });
  }

  const ctaHref = signedIn
    ? "/dashboard#upload"
    : "/signup?next=%2Fdashboard%23upload";

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] bg-[radial-gradient(circle_at_65%_30%,rgba(14,122,102,0.10),transparent_65%)]" />

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_70px_-32px_rgba(16,28,24,0.32),0_2px_6px_rgba(16,28,24,0.04)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <div>
              <p className="text-[12.5px] font-semibold leading-tight text-foreground">
                New conversion
              </p>
              <p className="text-[10.5px] text-muted-foreground">
                PDF bank statement
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Secure upload
          </span>
        </div>

        <div className="p-5">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Upload a PDF bank statement"
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {!file ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void choose(event.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30",
                dragging
                  ? "border-primary bg-accent/60"
                  : "border-border bg-[#fafcfb] hover:border-primary/40 hover:bg-accent/25"
              )}
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-primary shadow-[0_1px_3px_rgba(16,28,24,0.08)] ring-1 ring-border">
                {checking ? (
                  <ScanLine className="size-5 animate-pulse" />
                ) : (
                  <UploadCloud className="size-5" />
                )}
              </span>
              <p className="mt-4 text-[13.5px] font-medium text-foreground">
                {checking ? "Checking the file…" : "Drop your PDF statement here"}
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                or click to browse · PDF up to {MAX_FILE_MB} MB
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3 rounded-xl border border-border bg-[#fafcfb] p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary ring-1 ring-border">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="max-w-full truncate text-[12.5px] font-medium text-foreground">
                      {file.name}
                    </p>
                    <Badge variant="success" className="gap-1">
                      <Check className="size-2.5" />
                      PDF ready
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatFileSize(file.size)} · checked on your device
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Remove this file"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="mt-3 flex gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-[11px] leading-5 text-muted-foreground">
                  This preview keeps the file on your device — nothing is uploaded.
                  Sign in to run the real extraction in your private workspace.
                </p>
              </div>

              <Button asChild size="lg" className="mt-4 w-full">
                <Link href={ctaHref}>
                  {signedIn ? "Open your workspace" : "Create free account to convert"}
                  <ArrowRight />
                </Link>
              </Button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-3 w-full text-center text-[11.5px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Choose a different file
              </button>
            </div>
          )}

          {error ? (
            <p className="mt-2.5 text-[11px] font-medium text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-[#fbfcfb]">
          {[
            { icon: ScanLine, label: "Extract" },
            { icon: BadgeCheck, label: "Reconcile" },
            { icon: FileSpreadsheet, label: "Export" },
          ].map((step) => (
            <div
              key={step.label}
              className="flex items-center justify-center gap-2 px-2 py-3 text-[10.5px] font-medium text-muted-foreground"
            >
              <step.icon className="size-3.5 text-primary/80" />
              {step.label}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-4 right-4 hidden items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 shadow-[0_12px_32px_-16px_rgba(16,28,24,0.28)] sm:flex">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
          <FileSpreadsheet className="size-3.5" />
        </span>
        <div>
          <p className="text-[10.5px] font-semibold text-foreground">
            Excel + CSV ready
          </p>
          <p className="text-[9.5px] text-muted-foreground">
            Your books, without retyping
          </p>
        </div>
      </div>
    </div>
  );
}
