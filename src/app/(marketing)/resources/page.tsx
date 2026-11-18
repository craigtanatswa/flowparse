import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, FileText, ScanLine, Table2 } from "lucide-react";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { CtaPanel } from "@/components/seo/cta-panel";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { ARTICLES, articlePath } from "@/lib/seo/articles";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Bank Statement Conversion Guides",
  description:
    "Practical guides to converting bank statement PDFs to Excel and CSV, extracting transactions, using OCR, choosing a format and automating client statement workflows.",
  path: "/resources",
});

const topicLinks = [
  {
    icon: Table2,
    title: "Convert to Excel or CSV",
    body: "Understand the output, the columns and the reconciliation step.",
    links: [
      {
        href: "/convert-bank-statement-pdf-to-excel",
        label: "PDF to Excel",
      },
      { href: "/convert-bank-statement-pdf-to-csv", label: "PDF to CSV" },
      {
        href: "/convert-bank-statements-to-spreadsheets",
        label: "Statements to spreadsheets",
      },
    ],
  },
  {
    icon: ScanLine,
    title: "Scanned statements",
    body: "What OCR can and cannot recover from an image-only statement.",
    links: [
      { href: "/bank-statement-ocr", label: "Bank statement OCR" },
      {
        href: "/convert-scanned-bank-statement-to-excel",
        label: "Scanned to Excel",
      },
    ],
  },
  {
    icon: FileText,
    title: "Accounting workflows",
    body: "How practices and bookkeepers fit conversion into month-end.",
    links: [
      {
        href: "/bank-statement-converter-for-accountants",
        label: "For accountants",
      },
      {
        href: "/bank-statement-converter-for-bookkeepers",
        label: "For bookkeepers",
      },
      {
        href: "/bank-statement-converter-for-accounting-software",
        label: "Accounting software",
      },
    ],
  },
];

export default function ResourcesIndexPage() {
  const [featured, ...rest] = ARTICLES;
  const url = absoluteUrl("/resources");

  return (
    <>
      <JsonLd
        nodes={[
          {
            "@type": "CollectionPage",
            "@id": url,
            url,
            name: "Bank statement conversion guides",
            description:
              "Practical guides to converting bank statement PDFs to Excel and CSV.",
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              {
                "@type": "ListItem",
                position: 2,
                name: "Resources",
                item: url,
              },
            ],
          },
          {
            "@type": "ItemList",
            itemListElement: ARTICLES.map((article, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: article.title,
              url: absoluteUrl(articlePath(article.slug)),
            })),
          },
        ]}
      />

      <section className="border-b border-border/70 bg-[#fbfdfc]">
        <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-8 sm:px-8 lg:pb-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Resources" }]} />
          <p className="mt-8 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-primary">
            Resources
          </p>
          <h1 className="mt-3 max-w-3xl text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-[44px]">
            Bank statement conversion guides
          </h1>
          <p className="mt-4 max-w-3xl text-[14px] leading-7 text-muted-foreground">
            Practical, specific guides for turning PDF statements into usable
            spreadsheets: what to check, where conversions fail, and how OCR and
            accounting imports actually behave.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <section aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="sr-only">
            Featured guide
          </h2>
          <Link
            href={articlePath(featured.slug)}
            className="group grid gap-6 rounded-3xl border border-border bg-white p-6 transition-colors hover:border-primary/35 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center"
          >
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-primary">
                {featured.category} · {featured.readingMinutes} min read
              </p>
              <h3 className="mt-3 max-w-2xl text-[24px] font-semibold leading-tight tracking-[-0.03em] sm:text-[30px]">
                {featured.title}
              </h3>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted-foreground">
                {featured.description}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary">
              Read the guide
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </section>

        <section className="mt-10" aria-labelledby="all-guides-heading">
          <h2
            id="all-guides-heading"
            className="text-[22px] font-semibold tracking-[-0.025em]"
          >
            All guides
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {rest.map((article) => (
              <Link
                key={article.slug}
                href={articlePath(article.slug)}
                className="group flex flex-col rounded-2xl border border-border bg-white p-6 transition-colors hover:border-primary/35"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  {article.category} · {article.readingMinutes} min
                </p>
                <h3 className="mt-2.5 text-[16px] font-semibold leading-snug tracking-tight">
                  {article.title}
                </h3>
                <p className="mt-2 flex-1 text-[12.5px] leading-6 text-muted-foreground">
                  {article.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary">
                  Read guide
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="topics-heading">
          <h2
            id="topics-heading"
            className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.025em]"
          >
            <BookOpen className="size-5 text-primary" aria-hidden="true" />
            Browse by topic
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {topicLinks.map((topic) => {
              const Icon = topic.icon;
              return (
                <div
                  key={topic.title}
                  className="rounded-2xl border border-border bg-white p-6"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 text-[14px] font-semibold">{topic.title}</h3>
                  <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
                    {topic.body}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[12px]">
                    {topic.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-foreground/70 transition-colors hover:text-primary"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-10">
          <Button asChild variant="outline">
            <Link href="/banks">
              Browse bank-specific guides
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>

      <CtaPanel
        title="Read the guide, then try the workflow"
        body="Upload a statement, review the extracted ledger and reconcile it before you export. The Free plan includes 3 processed pages per month."
      />
    </>
  );
}
