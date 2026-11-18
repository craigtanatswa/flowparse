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

  const { supabase, user } = context;
  const { data: statement, error: statementError } = await supabase
    .from("uploaded_documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (statementError) {
    logServerError("Could not load statement", statementError);
    return jsonError("Could not load this statement.", 500);
  }
  if (!statement) return jsonError("Statement not found.", 404);

  const { data: transactions, error: transactionsError } = await supabase
    .from("extracted_transactions")
    .select("*")
    .eq("document_id", id)
    .eq("user_id", user.id)
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
  const { data: storagePath, error: deleteError } = await supabase.rpc(
    "delete_statement",
    { p_document_id: id }
  );

  if (deleteError) {
    if (/Document not found/i.test(deleteError.message)) {
      return jsonError("Statement not found.", 404);
    }
    logServerError("Could not delete statement", deleteError);
    return jsonError("Could not delete this statement. Please try again.", 500);
  }

  // The database row is the source of truth. If storage cleanup fails we keep
  // the deletion successful; the object remains private and unreachable from
  // the app, and can be removed by a maintenance job.
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(STATEMENTS_BUCKET)
      .remove([storagePath]);

    if (storageError) {
      logServerError("Could not remove statement file from storage", storageError);
    }
  }

  return new NextResponse(null, { status: 204 });
}
