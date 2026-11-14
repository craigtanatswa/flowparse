import { NextResponse } from "next/server";

import { getApiContext, jsonError, parseUuid } from "@/lib/api";
import { getProcessorEnv } from "@/lib/env";
import { logServerError } from "@/lib/log";

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
  const { data: statement, error: loadError } = await supabase
    .from("statements")
    .select("id,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadError) {
    logServerError("Could not load statement for processing", loadError);
    return jsonError("Could not start processing.", 500);
  }
  if (!statement) return jsonError("Statement not found.", 404);

  if (statement.status === "queued" || statement.status === "processing") {
    return NextResponse.json(
      { status: statement.status },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (statement.status === "completed" || statement.status === "partial") {
    return jsonError(
      "This statement has already been extracted. Upload a new copy to run extraction again.",
      409
    );
  }

  // A failed extraction must not overwrite rows the user has entered manually.
  const { count: existingRows, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("statement_id", id);

  if (countError) {
    logServerError("Could not check existing transactions", countError);
    return jsonError("Could not start processing.", 500);
  }
  if ((existingRows ?? 0) > 0) {
    return jsonError(
      "This statement already has saved rows. Retrying extraction would replace them, so upload a new copy instead.",
      409
    );
  }

  const processor = getProcessorEnv();
  if (!processor) {
    await markFailed(
      supabase,
      id,
      "The processing service is not configured. Please contact support."
    );
    return jsonError(NOT_CONFIGURED_MESSAGE, 503);
  }

  const { error: queueError } = await supabase
    .from("statements")
    .update({ status: "queued", error_message: null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (queueError) {
    logServerError("Could not queue statement", queueError);
    return jsonError("Could not start processing. Please try again.", 500);
  }

  try {
    const response = await fetch(`${processor.url}/v1/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-processor-key": processor.apiKey,
      },
      body: JSON.stringify({ statement_id: id, user_id: user.id }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Processor rejected statement ${id}: status ${response.status}`);
      await markQueuedFailed(supabase, id, REJECTED_MESSAGE);
      return jsonError(REJECTED_MESSAGE, 502);
    }

    return NextResponse.json(
      { status: "queued" },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logServerError("Could not contact processing service", error);
    await markQueuedFailed(supabase, id, UNAVAILABLE_MESSAGE);
    return jsonError(UNAVAILABLE_MESSAGE, 502);
  }
}

type ApiSupabase = NonNullable<Awaited<ReturnType<typeof getApiContext>>>["supabase"];

async function markQueuedFailed(supabase: ApiSupabase, id: string, message: string) {
  const { error } = await supabase
    .from("statements")
    .update({ status: "failed", error_message: message, processed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "queued");

  if (error) {
    logServerError("Could not record processing failure", error);
  }
}

async function markFailed(supabase: ApiSupabase, id: string, message: string) {
  const { error } = await supabase
    .from("statements")
    .update({ status: "failed", error_message: message, processed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logServerError("Could not record processing failure", error);
  }
}
