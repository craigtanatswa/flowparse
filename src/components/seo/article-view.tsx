import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { CtaPanel } from "@/components/seo/cta-panel";
import { JsonLd } from "@/components/seo/json-ld";
import { RichText } from "@/components/seo/rich-text";
import { Button } from "@/components/ui/button";
import type { ArticleContent } from "@/lib/seo/content-types";
import { relatedLinks } from "@/lib/seo/links";
import { absoluteUrl, OG_IMAGE_PATH, SITE_NAME, SITE_URL } from "@/lib/seo/site";

function headingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function ArticleView({ article }: { article: ArticleContent }) {
  const path = `/resources/${article.slug}`;
  const url = absoluteUrl(path);
  const related = relatedLinks(article.related);
  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Resources", href: "/resources" },
    { label: article.title },
  ];

  return (
    <>
      <JsonLd
        nodes={[
          {
            "@type": "BlogPosting",
            "@id": url,
            mainEntityOfPage: url,
            headline: article.title,
            description: article.description,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
            articleSection: article.category,
            inLanguage: "en",
            image: absoluteUrl(OG_IMAGE_PATH),
            author: {
              "@type": "Organization",
              name: SITE_NAME,
              url: SITE_URL,
            },
            publisher: {
              "@type": "Organization",
              name: SITE_NAME,
              url: SITE_URL,
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/apple-icon.png`,
              },
            },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Resources",
                item: absoluteUrl("/resources"),
              },
              {
                "@type": "ListItem",
                position: 3,
                name: article.title,
                item: url,
              },
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: article.faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          },
        ]}
      />

      <section className="border-b border-border/70 bg-[#fbfdfc]">
        <div className="mx-auto w-full max-w-5xl px-5 pb-12 pt-8 sm:px-8 lg:pb-16">
          <Breadcrumbs items={crumbs} />
          <p className="mt-8 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-primary">
            {article.category}
          </p>
          <h1 className="mt-3 max-w-4xl text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-[44px]">
            {article.title}
          </h1>
          <p className="mt-4 max-w-3xl text-[14px] leading-7 text-muted-foreground">
            {article.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>By FlowParse</span>
            <span aria-hidden="true">·</span>
            <span>
              Published{" "}
              <time dateTime={article.publishedAt}>
                {formatDate(article.publishedAt)}
              </time>
            </span>
            <span aria-hidden="true">·</span>
            <span>{article.readingMinutes} min read</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-5xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_250px]">
        <article className="min-w-0">
          <div className="space-y-3 text-[14px] leading-7 text-foreground/80">
            {article.intro.map((paragraph) => (
              <p key={paragraph}>
                <RichText text={paragraph} />
              </p>
            ))}
          </div>

          <div className="mt-10 space-y-10">
            {article.sections.map((section) => {
              const id = headingId(section.heading);
              return (
                <section key={section.heading} aria-labelledby={id}>
                  <h2
                    id={id}
                    className="scroll-mt-24 text-[21px] font-semibold tracking-[-0.025em]"
                  >
                    {section.heading}
                  </h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-3 text-[13.5px] leading-7 text-foreground/75"
                    >
                      <RichText text={paragraph} />
                    </p>
                  ))}
                  {section.bullets?.length ? (
                    <ul className="mt-4 list-disc space-y-2 pl-5 text-[13px] leading-6 text-foreground/75">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>
                          <RichText text={bullet} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {section.table ? (
                    <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
                      <table className="w-full border-collapse text-left text-[12.5px]">
                        {section.table.caption ? (
                          <caption className="border-b border-border bg-muted/40 px-4 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            {section.table.caption}
                          </caption>
                        ) : null}
                        <thead className="bg-muted/50">
                          <tr>
                            {section.table.headers.map((header) => (
                              <th
                                key={header}
                                scope="col"
                                className="border-b border-border px-4 py-2.5 font-semibold text-foreground"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row) => (
                            <tr key={row.join("|")} className="even:bg-muted/20">
                              {row.map((cell, index) => (
                                <td
                                  key={`${cell}-${index}`}
                                  className="border-b border-border/60 px-4 py-2.5 align-top text-foreground/75 last:border-b-0"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>

          <section id="faq" className="mt-12 scroll-mt-24" aria-labelledby="faq-heading">
            <h2
              id="faq-heading"
              className="text-[21px] font-semibold tracking-[-0.025em]"
            >
              Frequently asked questions
            </h2>
            <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-white">
              {article.faq.map((item) => (
                <details key={item.question} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[13px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
                    <span>{item.question}</span>
                    <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="mt-2.5 text-[12.5px] leading-6 text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <nav
            aria-label="Article contents"
            className="rounded-2xl border border-border bg-white p-5"
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Contents
            </p>
            <ul className="mt-3 space-y-2 text-[12px]">
              {article.sections.map((section) => (
                <li key={section.heading}>
                  <a
                    href={`#${headingId(section.heading)}`}
                    className="text-foreground/70 transition-colors hover:text-primary"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="rounded-2xl border border-border bg-white p-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Related reading
            </p>
            <ul className="mt-3 space-y-2.5 text-[12px]">
              {related.map((link) => (
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

          <div className="rounded-2xl border border-primary/20 bg-accent/60 p-5">
            <p className="text-[12.5px] font-semibold text-foreground">
              Convert a statement
            </p>
            <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">
              Review the ledger, reconcile the balance, then export Excel or CSV.
            </p>
            <Button asChild size="sm" className="mt-3 w-full">
              <Link href="/signup?next=%2Fdashboard%23upload">
                Start free
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </aside>
      </div>

      <CtaPanel
        title="Read less, convert more"
        body="Put the guide into practice on a real statement. The Free plan includes 3 processed pages per month, with no card required."
      />
    </>
  );
}
