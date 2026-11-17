export function getPublicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return { url, anonKey };
}

export function getProcessorEnv(): { url: string; apiKey: string } | null {
  // On Vercel, PROCESSOR_URL is injected at runtime by the `app` service's
  // binding to the internal `processor` service (see vercel.json). Locally,
  // set it to the processor's base URL, e.g. http://127.0.0.1:8000.
  const url = process.env.PROCESSOR_URL;
  const apiKey = process.env.PROCESSOR_API_KEY;
  if (!url || !apiKey) return null;
  return { url: url.replace(/\/+$/, ""), apiKey };
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
