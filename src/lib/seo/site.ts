/**
 * Canonical site constants used by metadata, structured data, sitemap and
 * robots. Keeping them in one place avoids drift between page metadata and the
 * generated XML sitemap.
 */
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (
  configuredSiteUrl || "https://www.flowparse.app"
).replace(/\/+$/, "");

export const SITE_NAME = "FlowParse";

export const SITE_TAGLINE =
  "Turn PDF bank statements into reconciled, editable Excel and CSV data";

export const SITE_DESCRIPTION =
  "Convert PDF bank statements into reconciled Excel and CSV files. FlowParse handles digital and scanned statements, flags ambiguous rows for review, and lets you export clean ledgers.";

export const OG_IMAGE_PATH = "/opengraph-image";
export const OG_IMAGE_ALT =
  "FlowParse — convert bank statements to Excel and CSV";

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
