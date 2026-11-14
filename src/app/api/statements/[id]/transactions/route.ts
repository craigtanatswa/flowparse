import { NextResponse } from "next/server";

import { getApiContext, jsonError, parseUuid } from "@/lib/api";
import { firstZodError, transactionChangesSchema } from "@/lib/validation";
import { logServerError } from "@/lib/log";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const context = await getApiContext();
  if (!context) return jsonError("You must be signed in.", 401);

  const id = parseUuid((await params).id);
  if (!id) return jsonError("Invalid statement id.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The changes could not be read.");
  }

  const parsed = transactionChangesSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstZodError(parsed.error));

  if (parsed.data.upserts.length === 0 && parsed.data.deletes.length === 0) {
    return jsonError("There are no changes to save.");
  }

  const { user, supabase } = context;
  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (statementError) {
    logServerError("Could not load statement for editing", statementError);
    return jsonError("Could not save your changes.", 500);
  }
  if (!statement) return jsonError("Statement not found.", 404);

  const upserts = parsed.data.upserts.map((row) => ({
    id: row.id || null,
    date: row.date || null,
    value_date: row.value_date || null,
    description: row.description,
    reference: row.reference,
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    currency: row.currency,
  }));

  const { error: saveError } = await supabase.rpc("apply_transaction_changes", {
    p_statement_id: id,
    p_upserts: upserts,
    p_deletes: parsed.data.deletes,
  });

  if (saveError) {
    if (
      /Transaction not found|Statement not found|Not authenticated/i.test(
        saveError.message
      )
    ) {
      return jsonError(
        "One of these rows changed in another tab or no longer exists. Refresh the statement and try again.",
        409
      );
    }
    logServerError("Could not apply transaction changes", saveError);
    return jsonError("Your changes could not be saved. Please try again.", 500);
  }

  const [{ data: updatedStatement, error: reloadStatementError }, { data: transactions, error: reloadTransactionsError }] =
    await Promise.all([
      supabase.from("statements").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("transactions")
        .select("*")
        .eq("statement_id", id)
        .order("sort_index", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (reloadStatementError || reloadTransactionsError || !updatedStatement) {
    logServerError("Could not reload saved statement", reloadStatementError, reloadTransactionsError);
    return jsonError(
      "Your changes were saved, but the updated statement could not be loaded. Refresh the page.",
      500
    );
  }

  return NextResponse.json(
    { statement: updatedStatement, transactions: transactions ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
