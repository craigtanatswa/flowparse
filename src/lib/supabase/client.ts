"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getPublicSupabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  if (!browserClient) {
    const { url, anonKey } = getPublicSupabaseEnv();
    browserClient = createBrowserClient<Database>(url, anonKey);
  }
  return browserClient;
}
