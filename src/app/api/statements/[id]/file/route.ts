import { NextResponse } from "next/server";

import { getApiContext, jsonError, parseUuid, sanitizeFileName } from "@/lib/api";
import { STATEMENTS_BUCKET } from "@/lib/constants";
import { logServerError } from "@/lib/log";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await getApiContext();
  if (!context) return jsonError("You must be signed in.", 401);

  const id = parseUuid((await params).id);
  if (!id) return jsonError("Invalid statement id.");

  const { supabase } = context;
  const { data: statement, error } = await supabase
    .from("statements")
    .select("file_name,storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logServerError("Could not load statement file details", error);
    return jsonError("Could not open this document.", 500);
  }
  if (!statement) return jsonError("Statement not found.", 404);

  const downloadName = sanitizeFileName(statement.file_name);
  const { data: signed, error: signedError } = await supabase.storage
    .from(STATEMENTS_BUCKET)
    .createSignedUrl(statement.storage_path, 120, { download: downloadName });

  if (signedError || !signed) {
    logServerError("Could not create signed download URL", signedError);
    return jsonError("The original PDF could not be opened.", 404);
  }

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
