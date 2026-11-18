import { describe, expect, it } from "vitest";

import { authQueryError, friendlyAuthError } from "@/lib/auth-errors";

describe("friendly auth errors", () => {
  it("does not disclose whether an account exists for a bad password", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe(
      "The email or password is incorrect."
    );
  });

  it("explains unconfirmed email and duplicate signup", () => {
    expect(friendlyAuthError("Email not confirmed")).toContain("confirm your email");
    expect(friendlyAuthError("User already registered")).toContain(
      "already exists"
    );
  });

  it("maps rate limits, network failures and invalid email", () => {
    expect(friendlyAuthError("email rate limit exceeded")).toContain(
      "Too many attempts"
    );
    expect(friendlyAuthError("Failed to fetch")).toContain(
      "Could not reach the authentication service"
    );
    expect(friendlyAuthError("Invalid email")).toBe("Enter a valid email address.");
  });

  it("keeps an unknown provider message rather than blanking it", () => {
    expect(friendlyAuthError("Something unusual happened")).toBe(
      "Something unusual happened"
    );
    expect(friendlyAuthError(null)).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("turns callback query errors into user-facing text", () => {
    expect(authQueryError("confirmation")).toContain("invalid or has expired");
    expect(authQueryError("missing-code")).toContain("incomplete");
    expect(authQueryError("other")).toContain("could not be completed");
    expect(authQueryError(null)).toBeNull();
  });
});
