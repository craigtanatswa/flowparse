import "server-only";

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getApiContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

export function sanitizeFileName(value: string): string {
  const base = value.split(/[\\/]/).pop() || "statement.pdf";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "-")
    .trim()
    .slice(0, 255);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

export function parseUuid(value: string): string | null {
  return isUuid(value) ? value.toLowerCase() : null;
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
