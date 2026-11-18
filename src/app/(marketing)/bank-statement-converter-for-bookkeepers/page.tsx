import type { Metadata } from "next";

import { LandingPageView } from "@/components/seo/landing-page-view";
import { getLandingPage } from "@/lib/seo/landing";
import { buildPageMetadata } from "@/lib/seo/metadata";

const page = getLandingPage("bank-statement-converter-for-bookkeepers")!;

export const metadata: Metadata = buildPageMetadata({
  title: page.title,
  description: page.description,
  path: `/${page.slug}`,
});

export default function Page() {
  return <LandingPageView page={page} />;
}