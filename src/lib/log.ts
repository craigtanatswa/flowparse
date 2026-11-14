/**
 * Server-side error logging that never echoes row values.
 *
 * Supabase/PostgREST errors can include constraint details, and PostgreSQL
 * "Failing row contains" messages can contain descriptions, account numbers,
 * or storage paths. Log only non-sensitive diagnostics.
 */
export function logServerError(context: string, ...errors: unknown[]): void {
  const diagnostics = errors.filter(Boolean).map((error) => {
    if (typeof error !== "object" || error === null) {
      return typeof error;
    }
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === "string" ? record.name : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
      status: typeof record.status === "number" ? record.status : undefined,
    };
  });
  console.error(context, diagnostics);
}
