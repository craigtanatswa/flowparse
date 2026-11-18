import { describe, expect, it } from "vitest";

import { FREE_PLAN, MARKETING_PLANS } from "@/lib/plans";

describe("plan page tiers", () => {
  it("keeps the Free plan at 3 pages", () => {
    expect(FREE_PLAN.pageLimit).toBe(3);
  });

  it("advertises 100, 1,000 and 10,000 pages for the paid plans", () => {
    const starter = MARKETING_PLANS.find((plan) => plan.id === "starter");
    const pro = MARKETING_PLANS.find((plan) => plan.id === "pro");
    const business = MARKETING_PLANS.find((plan) => plan.id === "business");

    expect(starter?.pageAllowance).toBe("100 pages / month");
    expect(pro?.pageAllowance).toBe("1,000 pages / month");
    expect(business?.pageAllowance).toBe("10,000 pages / month");
  });

  it("does not describe Business as unlimited", () => {
    const business = MARKETING_PLANS.find((plan) => plan.id === "business");
    expect(business?.features.join(" ").toLowerCase()).not.toContain("unlimited");
  });
});
