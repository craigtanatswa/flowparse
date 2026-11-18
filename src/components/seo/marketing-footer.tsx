import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { BANK_PAGES } from "@/lib/seo/banks";

const columns = [
  {
    heading: "Convert",
    links: [
      { href: "/convert-bank-statement-pdf-to-excel", label: "PDF to Excel" },
      { href: "/convert-bank-statement-pdf-to-csv", label: "PDF to CSV" },
      {
        href: "/convert-scanned-bank-statement-to-excel",
        label: "Scanned to Excel",
      },
      { href: "/bank-statement-ocr", label: "Bank statement OCR" },
      {
        href: "/convert-bank-statements-to-spreadsheets",
        label: "All converters",
      },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "/resources", label: "Guides" },
      {
        href: "/resources/how-to-convert-bank-statement-pdf-to-excel",
        label: "PDF to Excel guide",
      },
      {
        href: "/resources/convert-scanned-bank-statements-ocr",
        label: "OCR guide",
      },
      {
        href: "/resources/excel-vs-csv-bank-statement-conversion",
        label: "Excel vs CSV",
      },
    ],
  },
  {
    heading: "Who it is for",
    links: [
      {
        href: "/bank-statement-converter-for-accountants",
        label: "Accountants",
      },
      {
        href: "/bank-statement-converter-for-bookkeepers",
        label: "Bookkeepers",
      },
      {
        href: "/bank-statement-converter-for-accounting-software",
        label: "Accounting software",
      },
      ...BANK_PAGES.map((bank) => ({
        href: `/banks/${bank.slug}`,
        label: `${bank.name} statements`,
      })),
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <Logo imageClassName="h-8" />
          <p className="mt-4 max-w-xs text-[12px] leading-6 text-muted-foreground">
            Turn PDF bank statements into reconciled, editable Excel and CSV
            data. Built for the people who close the books.
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Private by default
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.heading}>
            <p className="text-[10.5px] font-semibold tracking-[0.02em] text-muted-foreground">
              {column.heading}
            </p>
            <ul className="mt-3.5 space-y-2.5 text-[12px] text-foreground/70">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link className="hover:text-foreground" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="text-[10.5px] font-semibold tracking-[0.02em] text-muted-foreground">
            Account
          </p>
          <ul className="mt-3.5 space-y-2.5 text-[12px] text-foreground/70">
            <li>
              <Link className="hover:text-foreground" href="/login">
                Sign in
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/signup">
                Create account
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/#pricing">
                Pricing
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" href="/forgot-password">
                Reset password
              </Link>
            </li>
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
  );
}
