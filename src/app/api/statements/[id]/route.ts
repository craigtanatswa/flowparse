import { NextResponse } from "next/server";

import { getApiContext, jsonError, parseUuid } from "@/lib/api";
import { STATEMENTS_BUCKET } from "@/lib/constants";
import { logServerError } from "@/lib/log";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await getApiContext();
  if (!context) return jsonError("You must be signed in.", 401);

  const id = parseUuid((await params).id);
  if (!id) return jsonError("Invalid statement id.");

  const { supabase } = context;
  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (statementError) {
    logServerError("Could not load statement", statementError);
    return jsonError("Could not load this statement.", 500);
  }
  if (!statement) return jsonError("Statement not found.", 404);

  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("*")
    .eq("statement_id", id)
    .order("sort_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (transactionsError) {
    logServerError("Could not load transactions", transactionsError);
    return jsonError("Could not load the transactions for this statement.", 500);
  }

  return NextResponse.json(
    { statement, transactions: transactions ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const context = await getApiContext();
  if (!context) return jsonError("You must be signed in.", 401);

  const id = parseUuid((await params).id);
  if (!id) return jsonError("Invalid statement id.");

  const { supabase } = context;
  const { data: statement, error: loadError } = await supabase
    .from("statements")
    .select("id,storage_path")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    logServerError("Could not load statement for deletion", loadError);
    return jsonError("Could not delete this statement.", 500);
  }
  if (!statement) return jsonError("Statement not found.", 404);

  const { error: deleteError } = await supabase
    .from("statements")
    .delete()
    .eq("id", id);

  if (deleteError) {
    logServerError("Could not delete statement", deleteError);
    return jsonError("Could not delete this statement. Please try again.", 500);
  }

  // The database row is the source of truth. If storage cleanup fails we keep
  // the deletion successful; the object remains private and unreachable from
  // the app, and can be removed by a maintenance job.
  const { error: storageError } = await supabase.storage
    .from(STATEMENTS_BUCKET)
    .remove([statement.storage_path]);

  if (storageError) {
    logServerError("Could not remove statement file from storage", storageError);
  }

  return new NextResponse(null, { status: 204 });
}
