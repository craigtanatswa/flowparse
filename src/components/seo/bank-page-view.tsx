import Link from "next/link";
import { ArrowRight, ChevronDown, Info } from "lucide-react";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { CtaPanel } from "@/components/seo/cta-panel";
import { JsonLd } from "@/components/seo/json-ld";
import { RichText } from "@/components/seo/rich-text";
import { Button } from "@/components/ui/button";
import type { BankContent } from "@/lib/seo/content-types";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo/site";

function headingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function BankPageView({ bank }: { bank: BankContent }) {
  const path = `/banks/${bank.slug}`;
  const url = absoluteUrl(path);
  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Bank guides", href: "/banks" },
    { label: bank.name },
  ];

  return (
    <>
      <JsonLd
        nodes={[
          {
            "@type": "WebPage",
            "@id": url,
            url,
            name: bank.title,
            description: bank.description,
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
                name: "Bank guides",
                item: absoluteUrl("/banks"),
              },
              {
                "@type": "ListItem",
                position: 3,
                name: bank.name,
                item: url,
              },
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: bank.faq.map((item) => ({
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
            Bank guide
          </p>
          <h1 className="mt-3 max-w-3xl text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-[44px]">
            {bank.title}
          </h1>
          <div className="mt-4 max-w-3xl space-y-3 text-[14px] leading-7 text-muted-foreground">
            {bank.intro.map((paragraph) => (
              <p key={paragraph}>
                <RichText text={paragraph} />
              </p>
            ))}
          </div>

          <dl className="mt-6 flex flex-wrap gap-2 text-[11px]">
            {[
              { label: "Region", value: bank.region },
              { label: "Currency", value: bank.currency },
              { label: "Date order", value: bank.dateOrder },
            ].map((item) => (
              <div
                key={item.label}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5"
              >
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-medium text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
        <div className="rounded-2xl border border-primary/20 bg-accent/50 p-5">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
            <Info className="size-4 text-primary" aria-hidden="true" />
            What has actually been tested
          </p>
          <p className="mt-2 text-[12.5px] leading-6 text-foreground/75">
            {bank.testedNote}
          </p>
          <ul className="mt-3 grid gap-1.5 text-[12px] text-foreground/75 sm:grid-cols-2">
            {bank.testedLayouts.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4 text-[11.5px] leading-6 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Independent product.</span>{" "}
            {bank.disclaimer}
          </p>
          <p className="mt-1">
            Bank names are used to describe statement conventions. Always check
            the extracted ledger against the original statement before using it.
          </p>
        </div>

        <article className="mt-10">
          <section aria-labelledby="profile-heading">
            <h2
              id="profile-heading"
              className="text-[21px] font-semibold tracking-[-0.025em]"
            >
              What the {bank.name} profile changes
            </h2>
            <p className="mt-3 text-[13.5px] leading-7 text-foreground/75">
              {bank.profileNote}
            </p>
          </section>

          <div className="mt-10 space-y-10">
            {bank.sections.map((section) => (
              <section key={section.heading} aria-labelledby={`${headingId(section.heading)}-heading`}>
                <h2
                  id={`${headingId(section.heading)}-heading`}
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
              </section>
            ))}
          </div>
        </article>

        <section id="faq" className="mt-12 scroll-mt-24" aria-labelledby="faq-heading">
          <h2
            id="faq-heading"
            className="text-[21px] font-semibold tracking-[-0.025em]"
          >
            Questions
          </h2>
          <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-white">
            {bank.faq.map((item) => (
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

        <div className="mt-10 rounded-2xl border border-border bg-white p-5">
          <p className="text-[13px] font-semibold">A different bank?</p>
          <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">
            FlowParse parses the document&apos;s own table, so a bank-specific profile
            is not required for every statement. Start with the general
            converter and review anything the extraction report flags.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/convert-bank-statement-pdf-to-excel">
                Convert PDF to Excel
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/banks">All bank guides</Link>
            </Button>
          </div>
        </div>
      </div>

      <CtaPanel
        title={`Convert a ${bank.name} statement`}
        body="Upload the PDF, review the ledger and reconcile it against the statement before exporting Excel or CSV."
      />
    </>
  );
}
