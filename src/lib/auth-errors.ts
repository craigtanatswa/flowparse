export function friendlyAuthError(message: string | undefined | null): string {
  const value = (message ?? "").trim();
  const lower = value.toLowerCase();

  if (!value) return "Something went wrong. Please try again.";
  if (lower.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }
  if (lower.includes("email not confirmed")) {
    return "Check your inbox and confirm your email before signing in.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (lower.includes("password should be at least")) {
    return "Choose a password with at least 8 characters.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a moment, then try again.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Could not reach the authentication service. Check that Supabase is running and try again.";
  }
  if (lower.includes("invalid email")) {
    return "Enter a valid email address.";
  }

  return value;
}

export function authQueryError(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value === "confirmation") {
    return "That confirmation link is invalid or has expired. Sign in, or create your account again.";
  }
  if (value === "missing-code") {
    return "The confirmation link was incomplete. Please try signing in.";
  }
  return "Sign-in could not be completed. Please try again.";
}
