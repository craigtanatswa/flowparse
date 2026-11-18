import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, FileSpreadsheet, ShieldCheck } from "lucide-react";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { CtaPanel } from "@/components/seo/cta-panel";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { BANK_PAGES } from "@/lib/seo/banks";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Bank Statement Converter Guides by Bank",
  description:
    "Bank-specific notes for converting PDF statements to Excel and CSV, covering statement conventions, tested layouts and the limits of bank profiles.",
  path: "/banks",
});

export default function BanksIndexPage() {
  const url = absoluteUrl("/banks");

  return (
    <>
      <JsonLd
        nodes={[
          {
            "@type": "CollectionPage",
            "@id": url,
            url,
            name: "Bank statement converter guides",
            description:
              "Bank-specific notes for converting PDF statements to Excel and CSV.",
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              {
                "@type": "ListItem",
                position: 2,
                name: "Bank guides",
                item: url,
              },
            ],
          },
        ]}
      />

      <section className="border-b border-border/70 bg-[#fbfdfc]">
        <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-8 sm:px-8 lg:pb-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Bank guides" }]} />
          <p className="mt-8 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-primary">
            Bank statements
          </p>
          <h1 className="mt-3 max-w-3xl text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-[44px]">
            Bank statement converter guides
          </h1>
          <p className="mt-4 max-w-3xl text-[14px] leading-7 text-muted-foreground">
            Banks print statements differently: currency, date order, column
            headings and page furniture all vary. FlowParse uses conservative
            profiles for several banks, but a profile only supplies defaults. The
            statement itself is always the authority.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <section aria-labelledby="available-heading">
          <h2
            id="available-heading"
            className="text-[22px] font-semibold tracking-[-0.025em]"
          >
            Guides with tested layouts
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">
            Each guide describes what the profile changes and which statement
            layouts are exercised by the test suite. We publish a bank page only
            after a fixture covers that bank&apos;s conventions.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {BANK_PAGES.map((bank) => (
              <Link
                key={bank.slug}
                href={`/banks/${bank.slug}`}
                className="group rounded-2xl border border-border bg-white p-6 transition-colors hover:border-primary/35"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                    <Building2 className="size-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    {bank.region}
                  </span>
                </div>
                <h3 className="mt-4 text-[16px] font-semibold tracking-tight">
                  {bank.name} statements
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">
                  {bank.currency} · {bank.dateOrder} · {bank.testedLayouts.length}{" "}
                  tested layout{bank.testedLayouts.length === 1 ? "" : "s"}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary">
                  Read the guide
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2" aria-labelledby="profiles-heading">
          <div className="rounded-2xl border border-border bg-white p-6">
            <h2
              id="profiles-heading"
              className="flex items-center gap-2 text-[16px] font-semibold tracking-tight"
            >
              <FileSpreadsheet className="size-4 text-primary" aria-hidden="true" />
              How bank profiles work
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12.5px] leading-6 text-muted-foreground">
              <li>
                A profile supplies defaults such as currency and date order when
                the statement does not state them.
              </li>
              <li>
                Transaction rows are still found from the document&apos;s own headers
                and geometry, not from a hard-coded layout.
              </li>
              <li>
                A currency or date order printed in the statement overrides the
                profile.
              </li>
              <li>
                An unfamiliar layout produces review flags or unresolved lines
                rather than invented transactions.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-6">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              What we do not claim
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12.5px] leading-6 text-muted-foreground">
              <li>We do not claim every statement from a bank will convert perfectly.</li>
              <li>We do not claim affiliation with or endorsement by any bank.</li>
              <li>We do not promise a fixed extraction accuracy percentage.</li>
              <li>
                We do not hide uncertainty: OCR pages and ambiguous rows are
                flagged for review.
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-white p-6" aria-labelledby="other-bank-heading">
          <h2 id="other-bank-heading" className="text-[16px] font-semibold tracking-tight">
            If your bank is not listed
          </h2>
          <p className="mt-2 max-w-3xl text-[12.5px] leading-6 text-muted-foreground">
            You do not need a bank-specific page to convert a statement. Start
            with the general PDF converter, review the reconciliation and the
            extraction report, and correct anything that is flagged.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/convert-bank-statement-pdf-to-excel">
                Convert PDF to Excel
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/convert-bank-statement-pdf-to-csv">Convert PDF to CSV</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/resources">Read the guides</Link>
            </Button>
          </div>
        </section>
      </div>

      <CtaPanel
        title="Test it on your own statement"
        body="Upload a PDF, check the extracted ledger against the statement, and export only when the reconciliation looks right."
      />
    </>
  );
}
