import type { MetadataRoute } from "next";

import { ARTICLES, articlePath } from "@/lib/seo/articles";
import { BANK_PAGES } from "@/lib/seo/banks";
import { LANDING_PAGES } from "@/lib/seo/landing";
import { absoluteUrl } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const contentDate = "2026-11-18";

  const landingPages: MetadataRoute.Sitemap = LANDING_PAGES.map((page) => ({
    url: absoluteUrl(`/${page.slug}`),
    lastModified: page.updatedAt,
    changeFrequency: "monthly",
    priority: page.slug.includes("convert-bank-statements")
      ? 0.9
      : 0.8,
  }));

  const bankPages: MetadataRoute.Sitemap = BANK_PAGES.map((bank) => ({
    url: absoluteUrl(`/banks/${bank.slug}`),
    lastModified: contentDate,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const articles: MetadataRoute.Sitemap = ARTICLES.map((article) => ({
    url: absoluteUrl(articlePath(article.slug)),
    lastModified: article.updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: absoluteUrl("/"),
      lastModified: contentDate,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...landingPages,
    {
      url: absoluteUrl("/banks"),
      lastModified: contentDate,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...bankPages,
    {
      url: absoluteUrl("/resources"),
      lastModified: contentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...articles,
  ];
}
