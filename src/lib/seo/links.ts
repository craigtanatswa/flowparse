import { ARTICLES, articlePath } from "@/lib/seo/articles";
import { BANK_PAGES } from "@/lib/seo/banks";
import { LANDING_PAGES } from "@/lib/seo/landing";

const labels = new Map<string, string>([
  ["/", "FlowParse home"],
  ["/banks", "Bank statement guides"],
  ["/resources", "Guides and resources"],
]);

for (const page of LANDING_PAGES) {
  labels.set(`/${page.slug}`, page.h1);
}
for (const article of ARTICLES) {
  labels.set(articlePath(article.slug), article.title);
}
for (const bank of BANK_PAGES) {
  labels.set(`/banks/${bank.slug}`, `${bank.name} statement conversion`);
}

export interface RelatedLink {
  href: string;
  label: string;
}

export function relatedLinks(paths: string[]): RelatedLink[] {
  return paths.map((href) => ({
    href,
    label: labels.get(href) ?? href,
  }));
}
