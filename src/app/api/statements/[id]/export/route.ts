import { NextResponse } from "next/server";

import { getApiContext, jsonError, parseUuid } from "@/lib/api";
import { buildStatementCsv, buildStatementWorkbook } from "@/lib/export";
import { logServerError } from "@/lib/log";
import { safeDownloadName } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: RouteContext) {
  const context = await getApiContext();
  if (!context) return jsonError("You must be signed in.", 401);

  const id = parseUuid((await params).id);
  if (!id) return jsonError("Invalid statement id.");

  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  if (format !== "csv" && format !== "xlsx") {
    return jsonError("Choose either CSV or XLSX export.");
  }

  const { supabase } = context;
  const [{ data: statement, error: statementError }, { data: transactions, error: transactionsError }] =
    await Promise.all([
      supabase.from("uploaded_documents").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("extracted_transactions")
        .select("*")
        .eq("document_id", id)
        .order("sort_index", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (statementError || transactionsError) {
    logServerError("Could not load statement for export", statementError, transactionsError);
    return jsonError("Could not prepare this export.", 500);
  }
  if (!statement) return jsonError("Statement not found.", 404);

  const baseName = safeDownloadName(statement.file_name, "transactions");

  try {
    if (format === "csv") {
      const csv = buildStatementCsv(statement, transactions ?? []);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const workbook = await buildStatementWorkbook(statement, transactions ?? []);
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        "Content-Length": String(workbook.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logServerError("Could not build statement export", error);
    return jsonError("Could not build this export. Please try again.", 500);
  }
}
