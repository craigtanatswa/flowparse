import Link from "next/link";
import { ArrowRight, Check, ChevronDown, FileSpreadsheet } from "lucide-react";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { CtaPanel } from "@/components/seo/cta-panel";
import { JsonLd } from "@/components/seo/json-ld";
import { RichText } from "@/components/seo/rich-text";
import { Button } from "@/components/ui/button";
import type { LandingPageContent } from "@/lib/seo/content-types";
import { relatedLinks } from "@/lib/seo/links";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo/site";

function headingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function LandingPageView({ page }: { page: LandingPageContent }) {
  const url = absoluteUrl(`/${page.slug}`);
  const crumbs = [
    { label: "Home", href: "/" },
    { label: page.h1 },
  ];
  const related = relatedLinks(page.related);
  const toc = [
    { id: "how-it-works", label: "How it works" },
    ...page.sections.map((section) => ({
      id: headingId(section.heading),
      label: section.heading,
    })),
    { id: "faq", label: "Questions" },
  ];

  return (
    <>
      <JsonLd
        nodes={[
          {
            "@type": "WebPage",
            "@id": url,
            url,
            name: page.h1,
            description: page.description,
            isPartOf: {
              "@type": "WebSite",
              name: SITE_NAME,
              url: SITE_URL,
            },
            publisher: {
              "@type": "Organization",
              name: SITE_NAME,
              url: SITE_URL,
            },
            dateModified: page.updatedAt,
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
                name: page.h1,
                item: url,
              },
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: page.faq.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          },
        ]}
      />

      <section className="relative isolate overflow-hidden border-b border-border/70 bg-[#fbfdfc]">
        <div className="pointer-events-none absolute inset-0 -z-10 marketing-grid marketing-fade opacity-60" />
        <div className="mx-auto w-full max-w-6xl px-5 pb-14 pt-8 sm:px-8 lg:pb-20 lg:pt-10">
          <Breadcrumbs items={crumbs} />
          <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-primary">
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            {page.eyebrow}
          </p>
          <h1 className="mt-5 max-w-4xl text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground sm:text-[48px] lg:text-[56px]">
            {page.h1}
          </h1>
          <div className="mt-5 max-w-3xl space-y-3 text-[14px] leading-7 text-muted-foreground sm:text-[15px]">
            {page.intro.map((paragraph) => (
              <p key={paragraph}>
                <RichText text={paragraph} />
              </p>
            ))}
          </div>

          <ul className="mt-7 grid max-w-4xl gap-2.5 sm:grid-cols-2">
            {page.keyPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-white/80 px-3.5 py-3 text-[12.5px] leading-5 text-foreground/80"
              >
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup?next=%2Fdashboard%23upload">
                Convert a statement
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/#pricing">See pricing</Link>
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            No card required. 3 processed pages free every month.
          </p>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_290px]">
        <article className="min-w-0">
          <section id="how-it-works" aria-labelledby="how-it-works-heading">
            <h2
              id="how-it-works-heading"
              className="text-[24px] font-semibold tracking-[-0.03em]"
            >
              How it works
            </h2>
            <ol className="mt-6 space-y-4">
              {page.steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-border/70 bg-white p-5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">
                      <RichText text={step.body} />
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-12 space-y-12">
            {page.sections.map((section) => {
              const id = headingId(section.heading);
              return (
                <section key={section.heading} aria-labelledby={`${id}-heading`}>
                  <h2
                    id={`${id}-heading`}
                    className="scroll-mt-24 text-[22px] font-semibold tracking-[-0.025em]"
                  >
                    {section.heading}
                  </h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-3 text-[13.5px] leading-7 text-muted-foreground"
                    >
                      <RichText text={paragraph} />
                    </p>
                  ))}
                  {section.bullets?.length ? (
                    <ul className="mt-4 space-y-2.5">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex items-start gap-2.5 text-[13px] leading-6 text-foreground/80"
                        >
                          <Check className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          <span>
                            <RichText text={bullet} />
                          </span>
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
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`${cell}-${cellIndex}`}
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

          <section className="mt-14" aria-labelledby="audience-heading">
            <h2
              id="audience-heading"
              className="text-[22px] font-semibold tracking-[-0.025em]"
            >
              {page.audienceHeading}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {page.audience.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border/70 bg-white p-5"
                >
                  <h3 className="text-[13.5px] font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section id="faq" className="mt-14 scroll-mt-24" aria-labelledby="faq-heading">
            <h2
              id="faq-heading"
              className="text-[22px] font-semibold tracking-[-0.025em]"
            >
              Questions
            </h2>
            <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-white">
              {page.faq.map((item) => (
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
          <div className="rounded-2xl border border-border bg-white p-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              On this page
            </p>
            <ul className="mt-3 space-y-2 text-[12px]">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-foreground/70 transition-colors hover:text-primary"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Related
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
              Try it on one statement
            </p>
            <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">
              The Free plan includes 3 processed pages per month. No card
              required.
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

      <CtaPanel />
    </>
  );
}
