import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

/**
 * Next's dev server normalises request URLs to localhost while the browser may
 * have opened the link on 127.0.0.1 (or another alias). Redirecting to a
 * different host would drop the session cookies that were just set, so keep
 * the origin of the incoming request unless an explicit public site URL is
 * configured.
 */
function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto") ||
      new URL(request.url).protocol.replace(":", "");
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));
  const origin = requestOrigin(request);

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing-code`);
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation`);
}
