import type { BankContent } from "@/lib/seo/content-types";

/**
 * Bank pages are deliberately limited to profiles the parser and test suite
 * actually exercise. Adding a bank here is a content decision and should follow
 * a tested fixture, not the existence of a name in the profile registry.
 */
export const BANK_PAGES: BankContent[] = [
  {
    slug: "barclays",
    name: "Barclays",
    region: "United Kingdom",
    currency: "GBP",
    dateOrder: "DD/MM/YYYY",
    title: "Convert Barclays Bank Statements to Excel",
    description:
      "How FlowParse handles Barclays-style PDF statements: GBP and DD/MM/YYYY defaults, tested digital, scanned and value-date layouts, and the limits of bank-specific parsing.",
    intro: [
      "Barclays statements normally use GBP and day-first dates, but the document itself is still the authority. FlowParse includes a Barclays profile that supplies those conventions only when the statement does not state them, then uses the document's own headers and values to extract transactions.",
      "This page explains what the profile changes, which Barclays-style layouts are exercised in our test suite, and what to check before you rely on the exported ledger.",
    ],
    profileNote:
      "The Barclays profile sets GBP and DD/MM/YYYY as parser defaults and recognises the Barclays name for the extraction report. Explicit evidence in the document always wins: a statement that states USD or a different date order is parsed from that evidence.",
    testedNote:
      "FlowParse's automated test suite uses synthetic statements with a Barclays header. It covers a digital two-page statement, a scanned copy processed with OCR, and a statement with a separate value-date and reference column. It is not a survey of every Barclays statement layout in circulation.",
    testedLayouts: [
      "Digital statement with a running balance column and a two-page table",
      "Scanned copy of the same layout, processed with OCR and marked for review",
      "Statement with a separate value-date column and payment references",
      "Barclays name and profile detection in the extraction report",
    ],
    disclaimer:
      "FlowParse is an independent product. It is not affiliated with, endorsed by or supported by Barclays.",
    sections: [
      {
        heading: "What the Barclays profile changes",
        bullets: [
          "Currency defaults to GBP when the statement does not state one.",
          "Dates are read day-first (DD/MM/YYYY) when the statement does not state an order.",
          "The bank name is reported as Barclays, so the extraction report is easier to file.",
          "A document's own currency, dates and column headers override every default.",
        ],
        paragraphs: [
          "The profile does not hard-code Barclays layouts. Transaction rows are still found from the document's geometry and headers, which is why the same parser can handle a layout we have not seen.",
        ],
      },
      {
        heading: "What our test suite covers",
        paragraphs: [
          "The three Barclays-named fixtures are generated for testing, not taken from real customers. The important part is what they exercise: a multi-page digital table, an image-only copy that requires OCR, and a value-date layout with references.",
          "The tests assert the bank name, the profile selection, the transaction count and the reconciliation values. They do not prove that every Barclays statement version will convert without review.",
        ],
      },
      {
        heading: "What to check on a Barclays conversion",
        bullets: [
          "Dates are day-first. A statement printed for a US account may use a different order; check the first few rows.",
          "The closing balance reconciles against the statement's own closing balance.",
          "Rows from scanned pages are flagged if OCR confidence is low.",
          "Page headers and footers have not become transaction rows.",
          "Value dates match the separate column when the statement prints one.",
        ],
      },
      {
        heading: "If your Barclays statement looks different",
        paragraphs: [
          "Barclays has issued many statement designs over the years, and business, personal and currency accounts do not all look the same. If a layout is unfamiliar, FlowParse reports the source lines it could not resolve instead of inventing rows. Those lines are listed in the extraction report so you can enter them manually.",
          "A digital PDF copied from online banking is the most reliable input. If you only have a scan, use a straight 300 DPI copy and review the OCR flags.",
        ],
      },
      {
        heading: "Other UK banks",
        paragraphs: [
          "The parser also has conservative profiles for several other UK banks, including HSBC, Lloyds, NatWest, Santander, Nationwide, Halifax, TSB and Monzo. Those profiles set currency and date defaults; they are not documented here as tested bank pages because this site only publishes a bank page after its layouts are exercised by a fixture.",
          "For any UK statement, start with [PDF to Excel](/convert-bank-statement-pdf-to-excel) or [PDF to CSV](/convert-bank-statement-pdf-to-csv).",
        ],
      },
    ],
    faq: [
      {
        question: "Is FlowParse affiliated with Barclays?",
        answer:
          "No. FlowParse is an independent product and is not endorsed by, affiliated with or supported by Barclays.",
      },
      {
        question: "Does every Barclays statement convert perfectly?",
        answer:
          "No. The test suite covers representative Barclays-style layouts, not every statement version the bank has issued. Unfamiliar layouts produce review flags or unresolved lines, and scanned statements depend on image quality.",
      },
      {
        question: "Does it support scanned Barclays statements?",
        answer:
          "Yes. A scanned copy is rendered and processed with OCR. The pages are marked, confidence is reported, and low-confidence rows are flagged before export.",
      },
      {
        question: "Which date format is assumed for Barclays statements?",
        answer:
          "Day-first (DD/MM/YYYY) is the default when the document does not state an order. A clear date order in the statement overrides the default.",
      },
      {
        question: "Can I convert a Barclays statement to CSV instead?",
        answer:
          "Yes. The same reviewed ledger can be exported as CSV for an accounting import or as XLSX for analysis.",
      },
    ],
  },
  {
    slug: "chase",
    name: "Chase",
    region: "United States",
    currency: "USD",
    dateOrder: "MM/DD/YYYY",
    title: "Convert Chase Bank Statements to Excel",
    description:
      "How FlowParse handles Chase-style US PDF statements: USD and MM/DD/YYYY defaults, the tested US layout, OCR handling and the limits of bank-specific parsing.",
    intro: [
      "US statements usually print month-first dates and USD amounts. FlowParse includes a Chase profile that supplies those conventions as defaults, then extracts transactions from the statement's own table structure.",
      "This page is deliberately specific about what has been tested. Our US fixture is a synthetic statement with a Chase header, not a real customer document, and bank layouts change over time.",
    ],
    profileNote:
      "The Chase profile sets USD and MM/DD/YYYY as parser defaults and recognises the Chase name for the extraction report. A currency or date order printed in the statement overrides those defaults.",
    testedNote:
      "The test suite includes a synthetic US statement with a Chase header and a USD, month-first layout. The tests verify profile detection, transaction extraction and reconciliation. We have not tested every Chase account type or statement revision.",
    testedLayouts: [
      "US digital statement with a Chase header and a running balance",
      "USD amounts with month-first dates (MM/DD/YYYY)",
      "Chase profile detection in the extraction report",
    ],
    disclaimer:
      "FlowParse is an independent product. It is not affiliated with, endorsed by or supported by JPMorgan Chase.",
    sections: [
      {
        heading: "What the Chase profile changes",
        bullets: [
          "Currency defaults to USD when the statement does not state one.",
          "Dates are read month-first (MM/DD/YYYY) when the statement does not state an order.",
          "The bank name is reported as Chase for the extraction report.",
          "Document evidence overrides every default.",
        ],
      },
      {
        heading: "What our test suite covers",
        paragraphs: [
          "The US fixture is generated for testing. It uses a Chase header, USD amounts and month-first dates, and the suite asserts that the Chase profile is selected and that the statement reconciles after extraction.",
          "That is a narrower claim than \"supports Chase statements\". It means a representative US layout is exercised automatically on every test run, not that every Chase PDF will convert cleanly.",
        ],
      },
      {
        heading: "What to check on a Chase conversion",
        bullets: [
          "Dates are month-first. If the statement is for a non-US account, confirm the order.",
          "Debits and credits are in the expected columns, not swapped by a sign convention.",
          "The running balance reconciles to the statement's closing balance.",
          "Scanned pages are flagged when OCR confidence is low.",
          "Multi-line merchant descriptions stay on one transaction row.",
        ],
      },
      {
        heading: "If your Chase statement looks different",
        paragraphs: [
          "Chase issues different statements for personal, business and credit accounts, and the layout has changed over time. If the table cannot be resolved, FlowParse reports the unresolved lines instead of guessing. Review those lines and enter them manually if needed.",
          "For best results, download the statement from online banking rather than scanning a printout. Digital statements keep their text layer and avoid OCR uncertainty.",
        ],
      },
      {
        heading: "Other US banks",
        paragraphs: [
          "The parser also includes profiles for Bank of America, Wells Fargo, Capital One, U.S. Bank, PNC and Citibank. Those profiles set currency and date defaults but are not published as tested bank pages here.",
          "For a US statement from any bank, the [PDF transaction extractor](/pdf-transaction-extractor) and [PDF to Excel](/convert-bank-statement-pdf-to-excel) pages describe the general workflow.",
        ],
      },
    ],
    faq: [
      {
        question: "Is FlowParse affiliated with Chase?",
        answer:
          "No. FlowParse is an independent product and is not endorsed by, affiliated with or supported by JPMorgan Chase.",
      },
      {
        question: "Has FlowParse been tested with real Chase statements?",
        answer:
          "The automated tests use a synthetic US statement with a Chase header. We do not claim access to a library of real Chase statements, and layouts vary by account type and statement date.",
      },
      {
        question: "Does it support scanned Chase statements?",
        answer:
          "Yes. Image-only pages are processed with OCR, marked in the report, and reviewed before export.",
      },
      {
        question: "Which date format is assumed?",
        answer:
          "Month-first (MM/DD/YYYY) is the default when the statement does not state an order. Explicit document evidence overrides it.",
      },
      {
        question: "Can I convert a Chase statement to CSV?",
        answer:
          "Yes. Export the reviewed ledger as CSV for an import or as XLSX for analysis.",
      },
    ],
  },
];

export function getBankPage(slug: string): BankContent | undefined {
  return BANK_PAGES.find((bank) => bank.slug === slug);
}
