"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps server-rendered status pages current while one or more statements are
 * being processed. The detail page and upload batch already poll; this covers
 * the dashboard and statement history when a job is opened in another tab.
 */
export function ActiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [active, router]);

  return null;
}
