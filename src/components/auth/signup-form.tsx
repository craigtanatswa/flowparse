"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, MailCheck, UserPlus } from "lucide-react";

import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/utils";

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const safeNext = safeNextPath(next);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
        window.location.origin;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(safeNext)}`,
        },
      });

      if (signUpError) {
        setError(friendlyAuthError(signUpError.message));
        setSubmitting(false);
        return;
      }

      if (data.session) {
        router.replace(safeNext);
        router.refresh();
        return;
      }

      setConfirmationEmail(email.trim());
      setSubmitting(false);
    } catch (unexpected) {
      setError(
        friendlyAuthError(unexpected instanceof Error ? unexpected.message : undefined)
      );
      setSubmitting(false);
    }
  }

  if (confirmationEmail) {
    return (
      <div>
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <MailCheck className="size-5" />
        </div>
        <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-foreground">
          Check your inbox
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{confirmationEmail}</span>.
          Open the link to finish creating your account.
        </p>

        <Alert variant="success" className="mt-6">
          <CheckCircle2 />
          <AlertDescription>
            After confirming, return here and sign in with your email and password.
          </AlertDescription>
        </Alert>

        <Button asChild size="lg" className="mt-6 w-full">
          <a href="/login">Go to sign in</a>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <p className="mb-3 text-[11px] font-semibold tracking-[0.01em] text-primary">
          Create your workspace
        </p>
        <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-foreground">
          Turn statements into clean data
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          One private workspace for your PDF statements, reconciled transaction
          previews, and Excel or CSV exports.
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
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <PasswordInput
              id="confirm-password"
              name="confirm-password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              disabled={submitting}
            />
          </div>
        </div>

        <p className="text-[11px] leading-5 text-muted-foreground">
          By creating an account you agree to keep only documents you are
          authorised to process. Your files stay private to your account.
        </p>

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <a
          href={`/login${safeNext !== "/dashboard" ? `?next=${encodeURIComponent(safeNext)}` : ""}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
