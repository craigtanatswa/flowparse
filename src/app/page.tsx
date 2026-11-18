import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  ListChecks,
  LockKeyhole,
  PencilLine,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { MarketingMobileNav } from "@/components/marketing/mobile-nav";
import { UploadDemo } from "@/components/marketing/upload-demo";
import { Logo, LogoGlyph, LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/auth";
import { FREE_PLAN, MARKETING_PLANS } from "@/lib/plans";
import {
  OG_IMAGE_ALT,
  OG_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo/site";

export const metadata: Metadata = {
  title: {
    absolute: "FlowParse — Convert bank statements to Excel and CSV",
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    title: "FlowParse — Convert bank statements to Excel and CSV",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlowParse — Convert bank statements to Excel and CSV",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

const features = [
  {
    icon: ScanLine,
    title: "Digital and scanned PDFs",
    body: "Reads the text layer when it exists and falls back to server-side OCR for scanned statements.",
  },
  {
    icon: BadgeCheck,
    title: "Balances that reconcile",
    body: "Opening balance plus credits minus debits is checked against the closing balance, with row-level balance checks.",
  },
  {
    icon: PencilLine,
    title: "Editable transaction preview",
    body: "Correct a description, amount, or date before exporting. Add or remove rows without losing the rest of the statement.",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel and CSV exports",
    body: "Download a formatted workbook with a statement summary, or a plain CSV ready for your accounting ledger.",
  },
  {
    icon: ListChecks,
    title: "Nothing silently discarded",
    body: "Uncertain rows stay visible and flagged for review. Partial extractions are shown as partial, never as complete.",
  },
  {
    icon: LockKeyhole,
    title: "Private by default",
    body: "Per-user database rules, private document storage, and authenticated exports keep your statements yours.",
  },
];

const faqs = [
  {
    question: "What file types can I upload?",
    answer:
      "FlowParse accepts PDF bank statements. Digital PDFs with a text layer are read directly; scanned PDFs are processed with OCR. Password-protected PDFs are not supported yet.",
  },
  {
    question: "Are scanned bank statements supported?",
    answer:
      "Yes. If a statement has no usable text layer, the processing service runs OCR on its pages. Scanned documents take longer, and any uncertain rows are kept and flagged for review rather than removed.",
  },
  {
    question: "Can I edit transactions before exporting?",
    answer:
      "Yes. Every extracted row is editable, and you can add or remove rows. Balances are recalculated when you save, and exports are blocked while you have unsaved changes.",
  },
  {
    question: "What happens if the extraction is not perfect?",
    answer:
      "The statement is marked as needing review and the rows that need attention are flagged. Nothing is silently discarded. You can correct the values, save the changes, and then export.",
  },
  {
    question: "What do the Excel and CSV exports contain?",
    answer:
      "Excel exports include a statement summary and a transactions sheet with dates, descriptions, references, debits, credits, and balances. CSV exports contain the same transaction rows in a plain, ledger-friendly format.",
  },
  {
    question: "Is my financial data private?",
    answer:
      "Statements are stored in private storage under your user account. Database access is enforced with per-user rules, and file and export downloads are generated only after an ownership check. Deleting a statement removes its extract and stored PDF.",
  },
  {
    question: "How much does FlowParse cost?",
    answer: `The Free plan includes ${FREE_PLAN.pageLimit} processed pages per calendar month, PDFs up to ${FREE_PLAN.fileSizeMb} MB, and basic transaction extraction. Starter is $9/month for 100 pages, Pro is $19/month for 400 pages, and Business is $39/month for unlimited pages. No card is required for Free.`,
  },
];

const extractedFields = [
  "Date",
  "Description",
  "Reference",
  "Debit",
  "Credit",
  "Balance",
  "Opening balance",
  "Closing balance",
  "Bank",
  "Account last 4",
];

export default async function LandingPage() {
  const user = await getOptionalUser();
  const primaryHref = user
    ? "/dashboard#upload"
    : "/signup?next=%2Fdashboard%23upload";
  const plansHref = user ? "/settings#plans" : "/signup?next=%2Fsettings%23plans";

  return (
    <>
      <JsonLd
        nodes={[
          {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: SITE_NAME,
            url: SITE_URL,
            logo: `${SITE_URL}/apple-icon.png`,
            description:
              "FlowParse converts PDF bank statements into reconciled Excel and CSV data.",
          },
          {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            name: SITE_NAME,
            url: SITE_URL,
            inLanguage: "en",
            publisher: { "@id": `${SITE_URL}/#organization` },
            description: SITE_DESCRIPTION,
          },
          {
            "@type": "SoftwareApplication",
            "@id": `${SITE_URL}/#app`,
            name: SITE_NAME,
            url: SITE_URL,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            description: SITE_DESCRIPTION,
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              description:
                "Free plan with 3 processed pages per month. Paid plans start at $9 per month.",
            },
          },
        ]}
      />
      <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Logo imageClassName="h-8" />

          <nav
            className="hidden items-center gap-7 text-[12.5px] font-medium text-muted-foreground md:flex"
            aria-label="Landing navigation"
          >
            <a className="transition-colors hover:text-foreground" href="#how-it-works">
              How it works
            </a>
            <a className="transition-colors hover:text-foreground" href="#features">
              Features
            </a>
            <a className="transition-colors hover:text-foreground" href="#formats">
              Formats
            </a>
            <a className="transition-colors hover:text-foreground" href="#pricing">
              Pricing
            </a>
            <a className="transition-colors hover:text-foreground" href="#faq">
              FAQ
            </a>
            <Link className="transition-colors hover:text-foreground" href="/resources">
              Resources
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/banks">
              Bank guides
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard">
                  Open workspace
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link href={primaryHref}>
                    Convert a Statement
                    <ArrowRight />
                  </Link>
                </Button>
              </>
            )}
            <MarketingMobileNav signedIn={Boolean(user)} />
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-border/70">
          <div className="pointer-events-none absolute inset-0 -z-10 marketing-grid marketing-fade opacity-70" />
          <div className="pointer-events-none absolute -right-48 -top-56 -z-10 size-[620px] rounded-full bg-emerald-100/45 blur-3xl" />
          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 lg:pb-28 lg:pt-20">
            <div>
              <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-white py-1.5 pl-2 pr-3 text-[11px] font-medium text-foreground/70 shadow-[0_1px_2px_rgba(16,28,24,0.04)]">
                <LogoMark className="size-[18px]" />
                PDF → Excel &amp; CSV
                <span className="text-border">|</span>
                Digital + scanned
              </div>

              <h1 className="mt-6 max-w-[680px] text-[42px] font-semibold leading-[1.04] tracking-[-0.045em] text-foreground sm:text-[56px] lg:text-[64px]">
                Turn bank statements into{" "}
                <span className="text-primary">structured financial data.</span>
              </h1>

              <p className="mt-6 max-w-xl text-[15px] leading-7 text-muted-foreground sm:text-base sm:leading-8">
                Upload a PDF bank statement and FlowParse extracts every transaction
                into a clean, editable ledger. Review the rows, confirm the balances,
                then download Excel or CSV — ready for your books.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-11 px-5">
                  <Link href={primaryHref}>
                    Convert a Statement
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 bg-white px-5">
                  <a href="#how-it-works">See How It Works</a>
                </Button>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11.5px] text-muted-foreground">
                {[
                  "No card required",
                  "Private per-user storage",
                  "Editable before export",
                ].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <span className="flex size-4 items-center justify-center rounded-full bg-accent text-primary">
                      <Check className="size-2.5" />
                    </span>
                    {item}
                  </span>
                ))}
              </div>

              <p className="mt-6 text-[11.5px] text-muted-foreground">
                Free plan includes {FREE_PLAN.pageLimit} processed pages per month.
              </p>
            </div>

            <div id="upload" className="scroll-mt-24 lg:pl-4">
              <UploadDemo signedIn={Boolean(user)} />
            </div>
          </div>
        </section>

        <div className="border-b border-border/70 bg-[#fbfcfb]">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-5 py-5 text-[11px] font-medium tracking-[0.01em] text-muted-foreground sm:px-8">
            <span>For bookkeepers</span>
            <span>Accountants</span>
            <span>Finance teams</span>
            <span>Small businesses</span>
          </div>
        </div>

        <section
          id="how-it-works"
          className="scroll-mt-20 border-b border-border/70"
        >
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.01em] text-primary">
                From PDF to ledger
              </p>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.035em] sm:text-[40px]">
                Three steps from statement to clean data.
              </h2>
              <p className="mt-4 text-[14px] leading-7 text-muted-foreground">
                FlowParse does the reading, parsing, and arithmetic. You keep the
                final say on every figure that reaches your spreadsheet.
              </p>
            </div>

            <div className="mt-11 grid gap-4 md:grid-cols-3">
              {[
                {
                  number: "01",
                  icon: UploadCloud,
                  title: "Upload your statements",
                  body: "Drop in one PDF or several at once. Each file is stored privately under your account.",
                },
                {
                  number: "02",
                  icon: Sparkles,
                  title: "Extract and reconcile",
                  body: "Dates, descriptions, debits, credits, and balances are extracted. Statement totals are checked.",
                },
                {
                  number: "03",
                  icon: FileSpreadsheet,
                  title: "Review and export",
                  body: "Fix anything that needs attention in the preview, save your changes, then download Excel or CSV.",
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_2px_rgba(16,28,24,0.03)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                      <step.icon className="size-[18px]" />
                    </span>
                    <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-6 text-[14.5px] font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-20 border-b border-border/70 bg-[#fafcfb]"
        >
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.01em] text-primary">
                  Built for the details
                </p>
                <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.035em] sm:text-[40px]">
                  The boring parts, handled properly.
                </h2>
                <p className="mt-4 max-w-md text-[14px] leading-7 text-muted-foreground">
                  A clean starting point you can trust — with exactly the right
                  places to look when something does not add up.
                </p>
                <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-[11px] font-medium text-foreground/70">
                  <BadgeCheck className="size-3.5 text-primary" />
                  Partial results are clearly flagged
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(16,28,24,0.03)]"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                      <feature.icon className="size-4" />
                    </span>
                    <h3 className="mt-4 text-[13.5px] font-semibold tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground">
                      {feature.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="formats" className="scroll-mt-20 border-b border-border/70">
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.01em] text-primary">
                Supported formats
              </p>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.035em] sm:text-[40px]">
                One PDF in. Clean files out.
              </h2>
              <p className="mt-4 text-[14px] leading-7 text-muted-foreground">
                Bring a digital or scanned bank statement. Take away a structured
                spreadsheet you can open in Excel, Google Sheets, or your accounting
                software.
              </p>
            </div>

            <div className="mt-11 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_2px_rgba(16,28,24,0.03)]">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                    <FileText className="size-[18px]" />
                  </span>
                  <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.02em] text-muted-foreground">
                    Input
                  </span>
                </div>
                <h3 className="mt-5 text-[15px] font-semibold tracking-tight">
                  PDF bank statements
                </h3>
                <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
                  Statements with a digital text layer are read directly. Scanned
                  statements are processed with OCR on the server.
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">File type</dt>
                    <dd className="mt-0.5 font-medium text-foreground">.pdf</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Maximum size</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {FREE_PLAN.fileSizeMb} MB
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Per batch</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      Varies by plan
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Scanned copies</dt>
                    <dd className="mt-0.5 font-medium text-foreground">OCR supported</dd>
                  </div>
                </dl>
                <p className="mt-4 text-[10.5px] leading-5 text-muted-foreground">
                  Password-protected PDFs and non-PDF documents are not supported yet.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-white p-6 shadow-[0_1px_2px_rgba(16,28,24,0.03)]">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                    <FileSpreadsheet className="size-[18px]" />
                  </span>
                  <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.02em] text-muted-foreground">
                    Output
                  </span>
                </div>
                <h3 className="mt-5 text-[15px] font-semibold tracking-tight">
                  Excel and CSV exports
                </h3>
                <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
                  Export once the rows are reviewed. Every download is generated from
                  the statement saved in your workspace.
                </p>

                <div className="mt-5 space-y-2.5 border-t border-border pt-5">
                  <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                    <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-[11.5px] font-medium text-foreground">
                        Excel workbook (.xlsx)
                      </p>
                      <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                        Statement summary plus a formatted transactions sheet.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                    <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-[11.5px] font-medium text-foreground">
                        Comma-separated values (.csv)
                      </p>
                      <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                        Plain transaction rows for any ledger or import tool.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-[#fbfcfb] p-6">
              <p className="text-[10.5px] font-semibold tracking-[0.02em] text-muted-foreground">
                What FlowParse extracts
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {extractedFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-foreground/75"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="scroll-mt-20 border-b border-border/70">
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-[#f3faf6] p-7 sm:p-10 lg:p-14">
              <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-[10.5px] font-semibold tracking-[0.01em] text-primary">
                    <LockKeyhole className="size-3" />
                    Security &amp; privacy
                  </div>
                  <h2 className="mt-5 max-w-xl text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-[38px]">
                    Financial documents deserve more than a shared drive.
                  </h2>
                  <p className="mt-4 max-w-xl text-[13.5px] leading-7 text-muted-foreground">
                    Every statement is tied to the account that uploaded it. Private
                    storage, row-level security, and server-side processing keep your
                    documents out of reach of other users — and out of the browser.
                  </p>
                </div>
                <div className="space-y-2.5">
                  {[
                    [
                      "Per-user access rules",
                      "Database policies on every statement and transaction.",
                    ],
                    [
                      "Private PDF storage",
                      "No public links. Downloads require an authenticated owner.",
                    ],
                    [
                      "No client-side secrets",
                      "Service credentials never enter the browser.",
                    ],
                    [
                      "Delete means delete",
                      "Removing a statement deletes its extracted rows and stored PDF.",
                    ],
                  ].map(([title, body]) => (
                    <div
                      key={title}
                      className="flex gap-3 rounded-xl border border-emerald-100 bg-white/80 p-4"
                    >
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                        <ShieldCheck className="size-3" />
                      </span>
                      <div>
                        <p className="text-[12px] font-medium text-foreground">{title}</p>
                        <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                          {body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="scroll-mt-20 border-b border-border/70 bg-[#fafcfb]"
        >
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-semibold tracking-[0.01em] text-primary">
                Pricing
              </p>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.035em] sm:text-[40px]">
                Start free. Upgrade when you need more.
              </h2>
              <p className="mt-4 text-[14px] leading-7 text-muted-foreground">
                Convert and export your first statements without a card, then upgrade
                for more pages, bulk processing, and priority extraction.
              </p>
            </div>

            <div className="mx-auto mt-11 grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {MARKETING_PLANS.map((marketingPlan) => (
                <div
                  key={marketingPlan.id}
                  className={`relative flex flex-col rounded-2xl border bg-white p-6 ${
                    marketingPlan.highlight
                      ? "border-primary/35 shadow-[0_12px_40px_-24px_rgba(14,122,102,0.35)] ring-1 ring-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">
                        {marketingPlan.name}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {marketingPlan.description}
                      </p>
                    </div>
                    {marketingPlan.highlight ? (
                      <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[9.5px] font-semibold text-primary">
                        Popular
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 flex items-end gap-1.5">
                    <span className="text-[34px] font-semibold leading-none tracking-[-0.04em]">
                      {marketingPlan.price}
                    </span>
                    <span className="pb-1 text-[11px] text-muted-foreground">
                      / {marketingPlan.cadence}
                    </span>
                  </div>
                  <p className="mt-2 text-[10.5px] text-muted-foreground">
                    {marketingPlan.pageAllowance}
                  </p>

                  <ul className="mt-5 space-y-2.5">
                    {marketingPlan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-[11.5px]"
                      >
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                          <Check className="size-2.5" />
                        </span>
                        <span className="text-foreground/75">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-6">
                    <Button
                      asChild
                      size="lg"
                      variant={marketingPlan.highlight ? "default" : "outline"}
                      className="w-full"
                    >
                      <Link href={marketingPlan.id === "free" ? primaryHref : plansHref}>
                        {marketingPlan.id === "free"
                          ? "Start free"
                          : `Choose ${marketingPlan.name}`}
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-5 max-w-xl text-center text-[10.5px] leading-5 text-muted-foreground">
              Prices are in USD. Paid plans renew monthly until cancelled. Payments,
              invoices and tax are handled securely by Dodo Payments.
            </p>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-b border-border/70">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.68fr_1.32fr] lg:gap-16 lg:py-24">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.01em] text-primary">
                FAQ
              </p>
              <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.035em] sm:text-[40px]">
                Questions, answered.
              </h2>
              <p className="mt-4 max-w-sm text-[14px] leading-7 text-muted-foreground">
                Everything you need to know before you put a real statement through
                the workspace.
              </p>
              <Button asChild variant="outline" className="mt-7 bg-white">
                <Link href={primaryHref}>
                  Convert a Statement
                  <ArrowRight />
                </Link>
              </Button>
            </div>

            <div className="border-t border-border">
              {faqs.map((faq) => (
                <details key={faq.question} className="group border-b border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-[13.5px] font-medium text-foreground outline-none [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="max-w-2xl pb-5 pr-8 text-[12.5px] leading-6 text-muted-foreground">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
          <div className="relative isolate overflow-hidden rounded-[28px] bg-primary px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
            <LogoGlyph
              inverted
              className="pointer-events-none absolute -right-12 -top-16 -z-10 size-[300px] opacity-[0.09]"
            />
            <div className="flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
              <div>
                <Logo dark imageClassName="h-7" />
                <h2 className="mt-5 max-w-xl text-[28px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-[34px]">
                  Your next statement could be a spreadsheet.
                </h2>
                <p className="mt-2.5 max-w-lg text-[13px] leading-6 text-[#ecfdf5]">
                  Upload a PDF, review the rows, and download clean books — without
                  retyping a single transaction.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2.5">
                <Button
                  asChild
                  size="lg"
                  className="h-11 bg-white px-5 text-primary shadow-none hover:bg-emerald-50"
                >
                  <Link href={primaryHref}>
                    Convert a Statement
                    <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 border-white/40 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#how-it-works">See How It Works</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <Logo imageClassName="h-8" />
            <p className="mt-4 max-w-xs text-[12px] leading-6 text-muted-foreground">
              Turn PDF bank statements into reconciled, editable Excel and CSV data.
              Built for the people who close the books.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              Private by default
            </p>
          </div>

          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.02em] text-muted-foreground">
              Product
            </p>
            <ul className="mt-3.5 space-y-2.5 text-[12px] text-foreground/70">
              <li><a className="hover:text-foreground" href="#how-it-works">How it works</a></li>
              <li><a className="hover:text-foreground" href="#features">Features</a></li>
              <li><a className="hover:text-foreground" href="#formats">Supported formats</a></li>
              <li><a className="hover:text-foreground" href="#pricing">Pricing</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.02em] text-muted-foreground">
              Convert
            </p>
            <ul className="mt-3.5 space-y-2.5 text-[12px] text-foreground/70">
              <li><Link className="hover:text-foreground" href="/convert-bank-statement-pdf-to-excel">PDF to Excel</Link></li>
              <li><Link className="hover:text-foreground" href="/convert-bank-statement-pdf-to-csv">PDF to CSV</Link></li>
              <li><Link className="hover:text-foreground" href="/convert-scanned-bank-statement-to-excel">Scanned to Excel</Link></li>
              <li><Link className="hover:text-foreground" href="/bank-statement-ocr">Bank statement OCR</Link></li>
              <li><Link className="hover:text-foreground" href="/convert-bank-statements-to-spreadsheets">All converters</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.02em] text-muted-foreground">
              Resources
            </p>
            <ul className="mt-3.5 space-y-2.5 text-[12px] text-foreground/70">
              <li><Link className="hover:text-foreground" href="/resources">Guides</Link></li>
              <li><Link className="hover:text-foreground" href="/resources/how-to-convert-bank-statement-pdf-to-excel">PDF to Excel guide</Link></li>
              <li><Link className="hover:text-foreground" href="/resources/excel-vs-csv-bank-statement-conversion">Excel vs CSV</Link></li>
              <li><Link className="hover:text-foreground" href="/banks">Bank guides</Link></li>
              <li><a className="hover:text-foreground" href="#faq">FAQ</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.02em] text-muted-foreground">
              Account
            </p>
            <ul className="mt-3.5 space-y-2.5 text-[12px] text-foreground/70">
              {user ? (
                <>
                  <li><Link className="hover:text-foreground" href="/dashboard">Dashboard</Link></li>
                  <li><Link className="hover:text-foreground" href="/statements">Statements</Link></li>
                  <li><Link className="hover:text-foreground" href="/settings">Settings</Link></li>
                </>
              ) : (
                <>
                  <li><Link className="hover:text-foreground" href="/login">Sign in</Link></li>
                  <li><Link className="hover:text-foreground" href="/signup">Create account</Link></li>
                  <li><Link className="hover:text-foreground" href="/forgot-password">Reset password</Link></li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-border">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-[10.5px] text-muted-foreground sm:flex-row sm:px-8">
            <p>© 2026 FlowParse. All rights reserved.</p>
            <p>Bank statements in. Structured financial data out.</p>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
