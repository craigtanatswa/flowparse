import type { Metadata } from "next";

import {
  absoluteUrl,
  OG_IMAGE_ALT,
  OG_IMAGE_PATH,
  SITE_NAME,
} from "@/lib/seo/site";

interface PageMetadataInput {
  /** Title without the site suffix; the root template adds " · FlowParse". */
  title: string;
  description: string;
  /** Site-relative canonical path, for example "/bank-statement-ocr". */
  path: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
}

/**
 * Build consistent metadata for every public content page: canonical URL,
 * Open Graph, Twitter card and (for articles) publication timestamps.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  type = "website",
  publishedTime,
  modifiedTime,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const image = {
    url: absoluteUrl(OG_IMAGE_PATH),
    width: 1200,
    height: 630,
    alt: OG_IMAGE_ALT,
  };

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      type,
      ...(type === "article"
        ? {
            publishedTime,
            modifiedTime: modifiedTime ?? publishedTime,
            authors: [SITE_NAME],
          }
        : {}),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}
