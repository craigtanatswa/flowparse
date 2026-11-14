import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { authQueryError } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <AuthShell>
      <LoginForm next={next} initialError={authQueryError(params.error)} />
    </AuthShell>
  );
}
