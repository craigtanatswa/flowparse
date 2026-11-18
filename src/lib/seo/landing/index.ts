import type { LandingPageContent } from "@/lib/seo/content-types";
import { audienceLandingPages } from "@/lib/seo/landing/audience";
import { conversionLandingPages } from "@/lib/seo/landing/conversion";
import { extractionLandingPages } from "@/lib/seo/landing/extraction";

export const LANDING_PAGES: LandingPageContent[] = [
  ...conversionLandingPages,
  ...extractionLandingPages,
  ...audienceLandingPages,
];

export const LANDING_PAGE_SLUGS = LANDING_PAGES.map((page) => page.slug);

export function getLandingPage(slug: string): LandingPageContent | undefined {
  return LANDING_PAGES.find((page) => page.slug === slug);
}
