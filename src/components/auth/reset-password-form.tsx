"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldAlert,
} from "lucide-react";

import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        setHasSession(Boolean(data.user));
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasSession(false);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(friendlyAuthError(updateError.message));
        setSubmitting(false);
        return;
      }
      setUpdated(true);
      setSubmitting(false);
    } catch (unexpected) {
      setError(
        friendlyAuthError(unexpected instanceof Error ? unexpected.message : undefined)
      );
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">
          Checking your reset link…
        </p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div>
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldAlert className="size-5" />
        </div>
        <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-foreground">
          Reset link expired
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This password reset link is invalid or has expired. Request a new link and
          open it in the same browser.
        </p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/forgot-password">
            Request a new link
            <ArrowRight />
          </Link>
        </Button>
        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  if (updated) {
    return (
      <div>
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <CheckCircle2 className="size-5" />
        </div>
        <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-foreground">
          Password updated
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your new password is active. You can continue to your workspace now, or
          sign in again with your new password on another device.
        </p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/dashboard">
            Continue to workspace
            <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
          <KeyRound className="size-[18px]" />
        </div>
        <h1 className="text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] text-foreground">
          Choose a new password
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          You opened a secure recovery link. Set a new password for your FlowParse
          account.
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
          <Label htmlFor="password">New password</Label>
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
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <PasswordInput
            id="confirm-password"
            name="confirm-password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={8}
            disabled={submitting}
          />
        </div>

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {submitting ? "Updating password…" : "Update password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        Need a new link?{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Request another email
        </Link>
      </p>
    </div>
  );
}
