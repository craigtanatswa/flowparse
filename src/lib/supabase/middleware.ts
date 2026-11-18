import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";
import { getPublicSupabaseEnv } from "@/lib/env";
import { logServerError } from "@/lib/log";

const PROTECTED_PREFIXES = ["/dashboard", "/statements", "/settings"];
const AUTH_ROUTES = ["/login", "/signup"];

const CANONICAL_HOST = "www.flowparse.app";
const ALIAS_HOSTS = new Set(["flowparse.app", "flowparse.vercel.app"]);

/**
 * Send the old Vercel deployment host and the apex domain to the official
 * canonical host so search engines and auth cookies see one origin. API paths
 * are deliberately left alone: an old Dodo webhook must keep working while the
 * domain changes. Auth callback paths are redirected so confirmation and
 * recovery cookies are set on the canonical host, not the legacy host.
 */
function canonicalRedirect(request: NextRequest): NextResponse | null {
  const rawHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!rawHost) return null;
  const host = rawHost.split(",")[0].split(":")[0].trim().toLowerCase();
  if (!ALIAS_HOSTS.has(host)) return null;

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return null;
  }

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export async function updateSession(request: NextRequest) {
  const canonical = canonicalRedirect(request);
  if (canonical) return canonical;

  let response = NextResponse.next({ request });

  let url: string;
  let anonKey: string;
  try {
    ({ url, anonKey } = getPublicSupabaseEnv());
  } catch (error) {
    logServerError("Could not read Supabase environment", error);
    return response;
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search || ""}`
    );
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}
