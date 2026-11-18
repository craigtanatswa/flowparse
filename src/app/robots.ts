import type { MetadataRoute } from "next";

import { absoluteUrl, SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/statements",
          "/settings",
          "/checkout/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
