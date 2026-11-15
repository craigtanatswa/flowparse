import { NextResponse } from "next/server";

import { loadAccountData } from "@/lib/account";
import { getApiContext, jsonError, sanitizeFileName } from "@/lib/api";
import { STATEMENTS_BUCKET } from "@/lib/constants";
import {
  currentMonthStartIso,
  nextAllowanceReset,
  planFileSizeBytes,
  planLimitReached,
} from "@/lib/plans";
import { uploadCreateSchema } from "@/lib/validation";
import { logServerError } from "@/lib/log";

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return jsonError("You must be signed in to upload a statement.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The upload request was invalid.");
  }

  const parsed = uploadCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "The upload request was invalid.");
  }

  const { user, supabase } = context;
  const account = await loadAccountData(supabase, user.id);
  const { plan } = account;

  if (parsed.data.fileSize > planFileSizeBytes(plan)) {
    return jsonError(
      `PDFs must be ${plan.fileSizeMb} MB or smaller on the ${plan.name} plan.`,
      413
    );
  }

  let monthlyStatements = account.usage.documents_uploaded;

  if (!account.usageAvailable) {
    // Usage triggers should always have a row, but fall back to a direct count
    // so a transient trigger/read failure does not block uploads.
    const { count, error: usageError } = await supabase
      .from("uploaded_documents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", currentMonthStartIso());

    if (usageError) {
      logServerError("Could not check monthly statement allowance", usageError);
      return jsonError(
        "Could not verify your monthly allowance. Please try again.",
        500
      );
    }
    monthlyStatements = count ?? 0;
  }

  if (planLimitReached(monthlyStatements, plan.statementLimit)) {
    return jsonError(
      `You have reached the ${plan.name} plan limit of ${plan.statementLimit} statements this month. Your allowance resets on ${nextAllowanceReset()}.`,
      403
    );
  }

  const statementId = crypto.randomUUID();
  const fileName = sanitizeFileName(parsed.data.fileName);
  const storagePath = `${user.id}/${statementId}/original.pdf`;

  const { error: insertError } = await supabase.from("uploaded_documents").insert({
    id: statementId,
    user_id: user.id,
    file_name: fileName,
    storage_path: storagePath,
    file_size: parsed.data.fileSize,
    mime_type: "application/pdf",
    status: "uploaded",
  });

  if (insertError) {
    logServerError("Could not create statement row", insertError);
    return jsonError("Could not create your upload. Please try again.", 500);
  }

  const { data: signedUpload, error: signError } = await supabase.storage
    .from(STATEMENTS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signedUpload) {
    logServerError("Could not create signed upload URL", signError);
    await supabase.from("uploaded_documents").delete().eq("id", statementId);
    return jsonError(
      "Could not prepare secure storage for this file. Please try again.",
      500
    );
  }

  return NextResponse.json(
    {
      statementId,
      path: signedUpload.path,
      token: signedUpload.token,
      fileName,
    },
    {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
