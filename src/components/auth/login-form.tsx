"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, LogIn } from "lucide-react";

import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/utils";

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(friendlyAuthError(signInError.message));
        setSubmitting(false);
        return;
      }

      router.replace(safeNextPath(next));
      router.refresh();
    } catch (unexpected) {
      setError(
        friendlyAuthError(unexpected instanceof Error ? unexpected.message : undefined)
      );
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <p className="mb-3 text-[11px] font-semibold tracking-[0.01em] text-primary">
          Welcome back
        </p>
        <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-foreground">
          Sign in to your workspace
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Pick up where you left off — your conversions and edits are kept
          private to your account.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {error ? (
          <Alert variant="danger">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={submitting}
            aria-invalid={Boolean(error)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-[11.5px] font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={submitting}
          />
        </div>

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <LogIn />}
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        New to FlowParse?{" "}
        <Link
          href={`/signup${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
