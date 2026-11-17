import { NextResponse } from "next/server";

import { getApiContext, jsonError, parseUuid } from "@/lib/api";
import { loadAccountData } from "@/lib/account";
import { getProcessorEnv } from "@/lib/env";
import { logServerError } from "@/lib/log";
import { nextAllowanceReset, planLimitReached } from "@/lib/plans";

type RouteContext = { params: Promise<{ id: string }> };

const NOT_CONFIGURED_MESSAGE =
  "The processing service is not configured. You can still enter transactions manually or try again later.";
const UNAVAILABLE_MESSAGE =
  "The processing service could not be reached. Please try again in a moment.";
const REJECTED_MESSAGE =
  "The processing service could not queue this statement. Please try again.";

export async function POST(_request: Request, { params }: RouteContext) {
  const context = await getApiContext();
  if (!context) return jsonError("You must be signed in.", 401);

  const id = parseUuid((await params).id);
  if (!id) return jsonError("Invalid statement id.");

  const { user, supabase } = context;
  const { data: document, error: loadError } = await supabase
    .from("uploaded_documents")
    .select("id,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadError) {
    logServerError("Could not load document for processing", loadError);
    return jsonError("Could not start processing.", 500);
  }
  if (!document) return jsonError("Statement not found.", 404);

  if (document.status === "queued" || document.status === "processing") {
    return NextResponse.json(
      { status: document.status },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (document.status === "completed" || document.status === "partial") {
    return jsonError(
      "This statement has already been extracted. Upload a new copy to run extraction again.",
      409
    );
  }

  const account = await loadAccountData(supabase, user.id);
  if (
    account.usageAvailable &&
    planLimitReached(account.usage.pages_processed, account.plan)
  ) {
    return jsonError(
      `You have used all ${account.plan.pageLimit} pages on the ${account.plan.name} plan this month. Your allowance resets on ${nextAllowanceReset()}. Upgrade your plan to keep processing statements.`,
      403
    );
  }

  // queue_conversion is SECURITY DEFINER: it verifies ownership, refuses to
  // overwrite saved rows or completed documents, and creates the next attempt.
  const { data: job, error: queueError } = await supabase.rpc("queue_conversion", {
    p_document_id: id,
  });

  if (queueError || !job) {
    const message = queueError?.message ?? "";
    if (
      message.includes("already been extracted") ||
      message.includes("already has saved rows")
    ) {
      return jsonError(message, 409);
    }
    if (message.includes("Document not found")) {
      return jsonError("Statement not found.", 404);
    }
    logServerError("Could not queue conversion", queueError);
    return jsonError("Could not start processing. Please try again.", 500);
  }

  const processor = getProcessorEnv();
  if (!processor) {
    await failConversion(supabase, job.id, NOT_CONFIGURED_MESSAGE);
    return jsonError(NOT_CONFIGURED_MESSAGE, 503);
  }

  try {
    const response = await fetch(new URL("v1/jobs", `${processor.url}/`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-processor-key": processor.apiKey,
      },
      body: JSON.stringify({
        document_id: id,
        job_id: job.id,
        user_id: user.id,
      }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    // 409 means the processor already has this document in flight. That is
    // success from the browser's point of view.
    if (!response.ok && response.status !== 409) {
      console.error(`Processor rejected document ${id}: status ${response.status}`);
      await failConversion(supabase, job.id, REJECTED_MESSAGE);
      return jsonError(REJECTED_MESSAGE, 502);
    }

    return NextResponse.json(
      { status: "queued", jobId: job.id },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logServerError("Could not contact processing service", error);
    await failConversion(supabase, job.id, UNAVAILABLE_MESSAGE);
    return jsonError(UNAVAILABLE_MESSAGE, 502);
  }
}

type ApiSupabase = NonNullable<Awaited<ReturnType<typeof getApiContext>>>["supabase"];

async function failConversion(
  supabase: ApiSupabase,
  jobId: string,
  message: string
) {
  const { error } = await supabase.rpc("fail_conversion", {
    p_job_id: jobId,
    p_message: message,
  });

  if (error) {
    logServerError("Could not record conversion failure", error);
  }
}
