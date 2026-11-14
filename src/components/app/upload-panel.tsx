"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Loader2,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { StatementStatusBadge } from "@/components/statement-status-badge";
import { Button } from "@/components/ui/button";
import {
  MAX_FILES_PER_UPLOAD,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  STATEMENTS_BUCKET,
  type AppStatus,
} from "@/lib/constants";
import { readStatus, type StatementPayload } from "@/lib/domain";
import { createClient } from "@/lib/supabase/client";
import { cn, formatFileSize, pluralize } from "@/lib/utils";

type SpecialStatus = "ready" | "uploading";
type ItemStatus = SpecialStatus | AppStatus;

interface UploadItem {
  key: string;
  file: File;
  status: ItemStatus;
  statementId?: string;
  error?: string;
  rowCount?: number;
  stage?: string;
  progress?: number | null;
}

interface CreateUploadResponse {
  statementId: string;
  path: string;
  token: string;
  fileName: string;
  error?: string;
}

const ACTIVE_STATUSES = new Set<ItemStatus>(["uploading", "queued", "processing", "uploaded"]);

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function hasPdfHeader(file: File): Promise<boolean> {
  const header = await file.slice(0, 1024).arrayBuffer();
  const text = new TextDecoder("latin1").decode(header);
  return text.includes("%PDF-");
}

function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case "ready":
      return item.file.type ? "Ready" : "Ready to upload";
    case "uploading":
      return "Uploading";
    case "uploaded":
      return "Uploaded";
    case "queued":
      return "Queued";
    case "processing":
      return "Extracting";
    case "completed":
      return "Extracted";
    case "partial":
      return "Needs review";
    case "failed":
      return "Failed";
  }
}

export function UploadPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const itemsRef = React.useRef<UploadItem[]>([]);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [retrying, setRetrying] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const activeWatchKey = items
    .filter(
      (item) =>
        item.statementId &&
        (item.status === "queued" ||
          item.status === "processing" ||
          item.status === "uploaded")
    )
    .map((item) => `${item.key}:${item.statementId}`)
    .join("|");

  React.useEffect(() => {
    if (!activeWatchKey) return;

    let cancelled = false;
    let inFlight = false;

    async function poll() {
      if (inFlight || cancelled) return;
      const watching = itemsRef.current.filter(
        (item) =>
          item.statementId &&
          (item.status === "queued" ||
            item.status === "processing" ||
            item.status === "uploaded")
      );
      if (!watching.length) return;

      inFlight = true;
      try {
        const results = await Promise.all(
          watching.map(async (item) => {
            try {
              const response = await fetch(
                `/api/statements/${item.statementId}`,
                { cache: "no-store" }
              );
              if (response.status === 404) {
                return { key: item.key, gone: true as const };
              }
              if (!response.ok) return { key: item.key, gone: false as const };
              const payload = await readJson<StatementPayload>(response);
              if (!payload) return { key: item.key, gone: false as const };
              return { key: item.key, gone: false as const, payload };
            } catch {
              return { key: item.key, gone: false as const };
            }
          })
        );

        if (cancelled) return;

        const updates = new Map(
          results
            .filter((result) => "payload" in result && result.payload)
            .map((result) => [result.key, result.payload as StatementPayload])
        );
        const goneKeys = new Set(
          results.filter((result) => result.gone).map((result) => result.key)
        );
        const finished: UploadItem[] = [];

        const nextItems = itemsRef.current.map((item) => {
          if (goneKeys.has(item.key)) {
            return {
              ...item,
              status: "failed" as ItemStatus,
              error: "This upload was removed before it finished.",
            };
          }
          const payload = updates.get(item.key);
          if (!payload) return item;
          const nextStatus = readStatus(payload.statement.status);
          const updated: UploadItem = {
            ...item,
            status: nextStatus,
            rowCount: payload.transactions.length,
            stage:
              nextStatus === "queued" || nextStatus === "processing"
                ? payload.statement.processing_stage ?? undefined
                : undefined,
            progress:
              nextStatus === "queued" || nextStatus === "processing"
                ? typeof payload.statement.progress_percent === "number"
                  ? payload.statement.progress_percent
                  : null
                : undefined,
            error:
              nextStatus === "failed"
                ? payload.statement.error_message ??
                  "Extraction failed. Open the statement to see details."
                : undefined,
          };
          if (
            nextStatus !== item.status &&
            (nextStatus === "completed" ||
              nextStatus === "partial" ||
              nextStatus === "failed")
          ) {
            finished.push(updated);
          }
          return updated;
        });

        itemsRef.current = nextItems;
        setItems(nextItems);

        if (finished.length) {
          const successful = finished.filter(
            (item) => item.status === "completed"
          ).length;
          const review = finished.filter((item) => item.status === "partial").length;
          const failed = finished.filter((item) => item.status === "failed").length;
          if (successful || review || failed) {
            const parts = [
              successful ? `${successful} extracted` : null,
              review ? `${review} needing review` : null,
              failed ? `${failed} failed` : null,
            ].filter(Boolean);
            toast.message("Processing finished", {
              description: parts.join(" · "),
            });
          }
          router.refresh();
        }
      } finally {
        inFlight = false;
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), 2500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeWatchKey, router]);

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (!incoming.length) return;

    const rejected: string[] = [];
    const existing = new Set(itemsRef.current.map((item) => fileKey(item.file)));
    const accepted: UploadItem[] = [];

    for (const file of incoming) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        rejected.push(`${file.name} is not a PDF.`);
        continue;
      }
      if (file.size <= 0) {
        rejected.push(`${file.name} is empty.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} is larger than ${MAX_FILE_MB} MB.`);
        continue;
      }
      if (existing.has(fileKey(file))) {
        rejected.push(`${file.name} is already in this batch.`);
        continue;
      }
      existing.add(fileKey(file));
      accepted.push({
        key: `${Date.now()}-${crypto.randomUUID()}`,
        file,
        status: "ready",
      });
    }

    const remainingSlots = Math.max(
      0,
      MAX_FILES_PER_UPLOAD - itemsRef.current.filter((item) => ACTIVE_STATUSES.has(item.status) || item.status === "ready").length
    );
    const toAdd = accepted.slice(0, remainingSlots);
    if (accepted.length > remainingSlots) {
      rejected.push(`Only ${MAX_FILES_PER_UPLOAD} files can be queued at once.`);
    }

    if (toAdd.length) {
      const next = [...itemsRef.current, ...toAdd];
      itemsRef.current = next;
      setItems(next);
    }
    if (rejected.length) {
      toast.error(rejected[0], {
        description:
          rejected.length > 1 ? `${rejected.length - 1} more file(s) were skipped.` : undefined,
      });
    }
  }

  function updateItem(key: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  async function cleanupStatement(statementId: string) {
    try {
      await fetch(`/api/statements/${statementId}`, { method: "DELETE" });
    } catch {
      // Best-effort cleanup. The statement is still private if it remains.
    }
  }

  async function uploadOne(item: UploadItem) {
    updateItem(item.key, { status: "uploading", error: undefined });
    let statementId: string | undefined;
    let stored = false;

    try {
      if (!(await hasPdfHeader(item.file))) {
        updateItem(item.key, {
          status: "failed",
          error: "This file does not look like a valid PDF.",
        });
        return;
      }

      const createResponse = await fetch("/api/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: item.file.name,
          fileSize: item.file.size,
        }),
      });
      const created = await readJson<CreateUploadResponse>(createResponse);
      if (!createResponse.ok || !created) {
        updateItem(item.key, {
          status: "failed",
          error: created?.error || "Could not create this upload.",
        });
        return;
      }
      statementId = created.statementId;

      const supabase = createClient();
      const { error: storageError } = await supabase.storage
        .from(STATEMENTS_BUCKET)
        .uploadToSignedUrl(created.path, created.token, item.file, {
          contentType: "application/pdf",
          cacheControl: "3600",
        });

      if (storageError) {
        await cleanupStatement(statementId);
        updateItem(item.key, {
          status: "failed",
          error: "The PDF could not be stored securely. Please try again.",
          statementId: undefined,
        });
        return;
      }
      stored = true;

      updateItem(item.key, { status: "queued", statementId });

      const processResponse = await fetch(
        `/api/statements/${statementId}/process`,
        { method: "POST" }
      );
      const processed = await readJson<{ status?: string; error?: string }>(
        processResponse
      );

      if (!processResponse.ok) {
        updateItem(item.key, {
          status: "failed",
          statementId,
          error:
            processed?.error ||
            "The processing service could not start. Open the statement to retry.",
        });
        router.refresh();
        return;
      }

      updateItem(item.key, { status: "processing", statementId });
    } catch (error) {
      if (statementId && !stored) {
        await cleanupStatement(statementId);
      }
      updateItem(item.key, {
        status: "failed",
        error: stored
          ? "The PDF was stored, but processing could not be started. Open the statement to retry."
          : error instanceof Error
            ? error.message
            : "This upload failed. Please try again.",
        statementId: stored ? statementId : undefined,
      });
    }
  }

  async function retryExtraction(item: UploadItem) {
    if (!item.statementId || retrying.has(item.key)) return;

    setRetrying((current) => new Set(current).add(item.key));
    updateItem(item.key, {
      status: "queued",
      error: undefined,
      stage: undefined,
      progress: null,
    });

    try {
      const response = await fetch(
        `/api/statements/${item.statementId}/process`,
        { method: "POST" }
      );
      const payload = await readJson<{ status?: string; error?: string }>(response);

      if (!response.ok) {
        const message =
          payload?.error ||
          "Extraction could not be retried. Open the statement for details.";
        updateItem(item.key, { status: "failed", error: message });
        toast.error("Retry could not start", { description: message });
        return;
      }

      toast.message("Extraction queued", {
        description: "This batch will update automatically when it finishes.",
      });
      router.refresh();
    } catch {
      const message = "Could not reach the processing service. Please try again.";
      updateItem(item.key, { status: "failed", error: message });
      toast.error("Retry could not start", { description: message });
    } finally {
      setRetrying((current) => {
        const next = new Set(current);
        next.delete(item.key);
        return next;
      });
    }
  }

  async function startUploads() {
    if (starting) return;
    const ready = itemsRef.current.filter((item) => item.status === "ready");
    if (!ready.length) return;

    setStarting(true);
    try {
      await Promise.all(ready.map((item) => uploadOne(item)));
    } finally {
      setStarting(false);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  function resetFailed() {
    setItems((current) =>
      current.map((item) =>
        item.status === "failed" && !item.statementId && item.file
          ? { ...item, status: "ready", error: undefined }
          : item
      )
    );
  }

  const readyCount = items.filter((item) => item.status === "ready").length;
  const activeCount = items.filter((item) => ACTIVE_STATUSES.has(item.status)).length;
  const hasRetryable = items.some((item) => item.status === "failed" && !item.statementId);
  const finishedCompleted = items.filter((item) => item.status === "completed").length;
  const finishedReview = items.filter((item) => item.status === "partial").length;
  const finishedFailed = items.filter((item) => item.status === "failed").length;
  const batchSummary = [
    finishedCompleted ? `${finishedCompleted} extracted` : null,
    finishedReview ? `${finishedReview} needing review` : null,
    finishedFailed ? `${finishedFailed} failed` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section id="upload" className="scroll-mt-24">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(20,32,28,0.03)]",
          compact ? "" : "ring-1 ring-black/[0.015]"
        )}
      >
        <div className="flex flex-col gap-1 border-b border-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">
              Upload statements
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Digital or scanned PDFs · up to {MAX_FILES_PER_UPLOAD} at a time ·{" "}
              {MAX_FILE_MB} MB each
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Private to your account
          </div>
        </div>

        <div className="p-5">
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
              addFiles(event.dataTransfer.files);
            }}
            className={cn(
              "group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/30",
              compact ? "py-7" : "py-10",
              dragging
                ? "border-primary bg-accent/60"
                : "border-border bg-[#fafcfb] hover:border-primary/35 hover:bg-accent/25"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label="Upload PDF bank statements"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-accent text-primary transition-transform group-hover:-translate-y-0.5">
              <UploadCloud className="size-5" />
            </span>
            <span className="text-sm font-medium text-foreground">
              Drop PDFs here, or click to browse
            </span>
            <span className="mt-1.5 max-w-md text-xs leading-5 text-muted-foreground">
              We&apos;ll detect the text layer and fall back to OCR automatically for
              scanned pages.
            </span>
          </div>

          {items.length ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-medium tracking-[0.01em] text-muted-foreground">
                  This batch
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setItems((current) =>
                      current.filter(
                        (item) =>
                          item.status !== "completed" &&
                          item.status !== "partial" &&
                          item.status !== "failed"
                      )
                    );
                  }}
                  disabled={!items.some((item) =>
                    ["completed", "partial", "failed"].includes(item.status)
                  )}
                  className="text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40"
                >
                  Clear finished
                </button>
              </div>

              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.key}
                    className={cn(
                      "rounded-xl border px-3.5 py-3",
                      item.status === "failed"
                        ? "border-rose-200 bg-rose-50/45"
                        : "border-border/80 bg-[#fafcfb]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                          item.status === "failed"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-white text-primary ring-1 ring-border/70"
                        )}
                      >
                        {item.status === "uploading" ||
                        item.status === "processing" ||
                        item.status === "queued" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : item.status === "failed" ? (
                          <AlertCircle className="size-4" />
                        ) : item.status === "completed" ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <FileText className="size-4" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="max-w-full truncate text-[12.5px] font-medium text-foreground">
                            {item.file.name}
                          </p>
                          {item.status === "ready" || item.status === "uploading" ? (
                            <span className="text-[10.5px] text-muted-foreground">
                              {formatFileSize(item.file.size)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {item.status === "ready" || item.status === "uploading" ? (
                            <span>{statusLabel(item)}</span>
                          ) : (
                            <StatementStatusBadge
                              status={
                                item.status === "uploaded" ? "queued" : item.status
                              }
                            />
                          )}
                          {item.stage &&
                          (item.status === "queued" || item.status === "processing") ? (
                            <span className="min-w-0 max-w-full truncate">
                              {item.stage}
                            </span>
                          ) : null}
                          {typeof item.progress === "number" &&
                          (item.status === "queued" || item.status === "processing") ? (
                            <span className="tabular-nums">{item.progress}%</span>
                          ) : null}
                          {item.rowCount !== undefined &&
                          (item.status === "completed" || item.status === "partial") ? (
                            <span>{pluralize(item.rowCount, "row")}</span>
                          ) : null}
                        </div>
                        {item.error ? (
                          <p className="mt-1.5 text-[11px] leading-5 text-rose-700">
                            {item.error}
                          </p>
                        ) : null}
                        {item.status === "uploading" ? (
                          <div
                            className="upload-progress relative mt-2 h-1 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-label={`Uploading ${item.file.name}`}
                          />
                        ) : null}
                        {item.status === "processing" &&
                        typeof item.progress === "number" ? (
                          <div
                            className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-label={`Extraction progress for ${item.file.name}`}
                            aria-valuenow={item.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-500"
                              style={{
                                width: `${Math.max(0, Math.min(100, item.progress))}%`,
                              }}
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {item.status === "failed" && item.statementId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => void retryExtraction(item)}
                            disabled={retrying.has(item.key)}
                            className="text-muted-foreground hover:text-primary"
                            aria-label={`Retry extraction for ${item.file.name}`}
                            title="Retry extraction"
                          >
                            {retrying.has(item.key) ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <RotateCcw />
                            )}
                          </Button>
                        ) : null}
                        {item.statementId ? (
                          <Button asChild variant="ghost" size="icon-sm">
                            <Link
                              href={`/statements/${item.statementId}`}
                              aria-label={`Open ${item.file.name}`}
                            >
                              <ArrowUpRight />
                            </Link>
                          </Button>
                        ) : null}
                        {item.status !== "uploading" &&
                        item.status !== "queued" &&
                        item.status !== "processing" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground"
                            onClick={() => removeItem(item.key)}
                            aria-label={`Remove ${item.file.name} from the batch`}
                          >
                            <X />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground">
                  {activeCount
                    ? `${activeCount} file(s) still processing. You can leave this page.`
                    : readyCount
                      ? `${readyCount} file(s) ready to upload.`
                      : batchSummary || "This batch has finished."}
                </p>
                <div className="flex gap-2">
                  {hasRetryable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetFailed}
                      disabled={starting}
                    >
                      <RotateCcw />
                      Retry failed uploads
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => void startUploads()}
                    disabled={starting || !readyCount}
                  >
                    {starting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <UploadCloud />
                    )}
                    {starting
                      ? "Uploading…"
                      : readyCount
                        ? `Upload ${readyCount} statement${readyCount === 1 ? "" : "s"}`
                        : "Upload"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
