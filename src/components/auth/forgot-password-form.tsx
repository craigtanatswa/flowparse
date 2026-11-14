"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
        window.location.origin;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
        }
      );

      if (resetError) {
        const lower = resetError.message.toLowerCase();
        const hardFailure =
          lower.includes("rate limit") ||
          lower.includes("too many") ||
          lower.includes("failed to fetch") ||
          lower.includes("network");
        if (hardFailure) {
          setError(friendlyAuthError(resetError.message));
          setSubmitting(false);
          return;
        }
      }

      setSent(true);
      setSubmitting(false);
    } catch (unexpected) {
      setError(
        friendlyAuthError(unexpected instanceof Error ? unexpected.message : undefined)
      );
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div>
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <MailCheck className="size-5" />
        </div>
        <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-foreground">
          Check your inbox
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          If an account exists for{" "}
          <span className="font-medium text-foreground">{email.trim()}</span>, we
          sent a link to reset your password.
        </p>

        <Alert variant="info" className="mt-6">
          <AlertCircle />
          <AlertDescription>
            The link expires after a short time. Check your spam folder if it does
            not arrive within a few minutes.
          </AlertDescription>
        </Alert>

        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/login">
            <ArrowLeft />
            Back to sign in
          </Link>
        </Button>

        <button
          type="button"
          onClick={() => {
            setSent(false);
            setSubmitting(false);
          }}
          className="mt-4 w-full text-center text-[12px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Use a different email address
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <p className="mb-3 text-[11px] font-semibold tracking-[0.01em] text-primary">
          Password recovery
        </p>
        <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-foreground">
          Reset your password
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Enter the email address you use for FlowParse. We&apos;ll send you a
          secure link to choose a new password.
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

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}
          {submitting ? "Sending reset link…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
