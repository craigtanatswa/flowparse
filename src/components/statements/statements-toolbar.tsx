"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Extracted" },
  { value: "partial", label: "Needs review" },
  { value: "active", label: "Processing" },
  { value: "failed", label: "Failed" },
] as const;

export function StatementsToolbar({
  initialQuery,
  status,
}: {
  initialQuery: string;
  status: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  function navigate(nextQuery: string, nextStatus: string) {
    const params = new URLSearchParams(searchParams.toString());
    const cleaned = nextQuery.trim();
    if (cleaned) params.set("q", cleaned);
    else params.delete("q");
    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    else params.delete("status");
    params.delete("page");
    const search = params.toString();
    startTransition(() => {
      router.push(search ? `/statements?${search}` : "/statements");
    });
  }

  const hasFilters = Boolean(initialQuery) || status !== "all";

  return (
    <div className="mb-5 flex flex-col gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-[0_1px_2px_rgba(20,32,28,0.03)] sm:flex-row sm:items-center">
      <form
        className="relative min-w-0 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(query, status);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by file name…"
          aria-label="Search statements by file name"
          className="h-9 border-0 bg-transparent pl-9 pr-9 shadow-none focus-visible:ring-0"
        />
        {query ? (
          <button
            type="button"
            className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => {
              setQuery("");
              navigate("", status);
            }}
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </form>

      <div className="flex items-center gap-2 sm:border-l sm:border-border/80 sm:pl-2.5">
        <SlidersHorizontal className="ml-1 hidden size-3.5 text-muted-foreground sm:block" />
        <label htmlFor="status-filter" className="sr-only">
          Filter by status
        </label>
        <select
          id="status-filter"
          value={status}
          onChange={(event) => navigate(query, event.target.value)}
          className={cn(
            "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[12.5px] font-medium text-foreground outline-none transition-colors focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring/15 sm:w-[140px]",
            pending && "opacity-70"
          )}
        >
          {FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
        {hasFilters ? (
          <Button asChild variant="ghost" size="sm" className="h-9 shrink-0">
            <Link href="/statements">Reset</Link>
          </Button>
        ) : null}
        {pending ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
      </div>
    </div>
  );
}
