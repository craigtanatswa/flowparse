import { afterEach, describe, expect, it, vi } from "vitest";

describe("canonical site URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to the official www domain when the env is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.resetModules();
    const { SITE_URL, absoluteUrl } = await import("@/lib/seo/site");

    expect(SITE_URL).toBe("https://www.flowparse.app");
    expect(absoluteUrl("/pricing")).toBe("https://www.flowparse.app/pricing");
  });

  it("uses the configured origin and strips a trailing slash", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.flowparse.app/");
    vi.resetModules();
    const { SITE_URL } = await import("@/lib/seo/site");

    expect(SITE_URL).toBe("https://www.flowparse.app");
  });

  it("does not rewrite an absolute URL", async () => {
    const { absoluteUrl } = await import("@/lib/seo/site");
    expect(absoluteUrl("https://example.test/a")).toBe("https://example.test/a");
  });
});
