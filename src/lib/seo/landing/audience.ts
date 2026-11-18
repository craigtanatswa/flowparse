import type { LandingPageContent } from "@/lib/seo/content-types";

export const audienceLandingPages: LandingPageContent[] = [
  {
    slug: "bank-statement-converter-for-accountants",
    title: "Bank Statement Converter for Accountants",
    description:
      "Convert client bank statement PDFs into reconciled Excel workpapers or CSV imports. Consistent columns, review flags and a private workspace.",
    eyebrow: "For accountants",
    h1: "Bank statement converter for accountants",
    intro: [
      "Month-end is not short of statements. It is short of reliable ways to turn a client's PDF into a working paper without retyping a page of transactions. The task is repetitive, easy to get subtly wrong, and hard to review after the fact.",
      "FlowParse converts a statement into a ledger with a reconciliation, an extraction report and review flags. The output is designed to be checked, not simply trusted, which is what makes it usable in a professional workflow.",
    ],
    keyPoints: [
      "A consistent ledger and workpaper structure for every client statement.",
      "Opening and closing balance reconciliation shown on each conversion.",
      "Flagged rows explain what needs a human decision before the numbers are used.",
      "Private per-user storage; client statements are not shared between accounts.",
    ],
    steps: [
      {
        title: "Receive or collect the PDF",
        body: "Use the statement the client already has. There is no need to ask for a bank feed, a CSV export or a different file format.",
      },
      {
        title: "Convert and review",
        body: "Upload the statement, check the reconciliation, and clear the flagged rows. The extraction report shows what was uncertain and why.",
      },
      {
        title: "Export the workpaper",
        body: "Download Excel for the working paper or CSV for an accounting import. Keep the original PDF with the workpaper for the audit file.",
      },
    ],
    sections: [
      {
        heading: "The month-end bottleneck",
        paragraphs: [
          "A PDF statement is a presentation document. Its columns are sized for paper, its descriptions wrap, and its header repeats on every page. Copying it into Excel produces text in the wrong cells and a reconciliation you have to rebuild by hand.",
          "The cost is not just typing. It is the review time afterwards: checking whether a missing row was missed by the client, by the PDF, or by the person copying it.",
        ],
      },
      {
        heading: "A repeatable workpaper structure",
        paragraphs: [
          "Every FlowParse export uses the same transaction schema: date, value date, description, reference, debit, credit, balance, currency and review note. When the schema is stable, a workpaper template, pivot table or import mapping survives from one client to the next.",
          "The extraction report travels with the statement. It records the confidence level, the OCR pages and the source lines that could not be resolved, so a reviewer can see the boundaries of the automation.",
        ],
      },
      {
        heading: "Handling client statements",
        bullets: [
          "Digital statements convert directly from the text layer.",
          "Scanned client uploads use OCR and are clearly marked as OCR output.",
          "Passwords must be removed before upload; encrypted PDFs are rejected with an error.",
          "A batch keeps each statement as a separate document with its own report.",
          "Files can be deleted after the work is complete.",
        ],
      },
      {
        heading: "Controls that matter",
        bullets: [
          "Balance reconciliation against the statement's own opening and closing figures.",
          "Row-level review reasons for ambiguous dates, currencies and amounts.",
          "Duplicate detection within a statement.",
          "Unresolved source lines reported rather than discarded.",
          "No plan changes or entitlements are driven by the browser; billing state is applied only from signed Dodo webhooks.",
        ],
      },
      {
        heading: "What FlowParse does not do",
        paragraphs: [
          "It is not a practice management system, a document portal or an e-signature tool. It does not connect to client bank accounts and it does not post journals into accounting software. It converts statements into structured data and gives you a review step.",
          "That scope is deliberate. The output is meant to fit into the tools and workpapers you already use, not to replace them.",
        ],
      },
    ],
    audienceHeading: "Where it fits in an accounting practice",
    audience: [
      {
        title: "Year-end accounts",
        body: "Turn a year of client statements into a transaction dataset for analysis and sampling.",
      },
      {
        title: "Management accounts",
        body: "Convert the month's statements before a management reporting deadline.",
      },
      {
        title: "Audit support",
        body: "Produce a sortable ledger and keep the original PDFs alongside it.",
      },
      {
        title: "Loan and grant applications",
        body: "Give lenders or grant bodies a clean transaction schedule without sharing bank access.",
      },
    ],
    faq: [
      {
        question: "Can I use FlowParse for multiple clients?",
        answer:
          "Each FlowParse account is a private workspace. Practices that need separate client ownership should use a separate account per client or per engagement, subject to your own confidentiality policy.",
      },
      {
        question: "Is there an audit trail?",
        answer:
          "Each conversion records the extraction report, confidence and review flags. The workspace keeps the statement and its extracted rows. FlowParse is not a full audit-logging platform, so retain the original PDF and your own workpaper evidence.",
      },
      {
        question: "How accurate is the conversion?",
        answer:
          "Digital statements with a clean text layer are the most reliable. Scanned statements depend on OCR quality and are marked accordingly. FlowParse flags uncertain rows rather than guaranteeing every field, and the reconciliation gives you a second check.",
      },
      {
        question: "Can I convert a batch of client statements?",
        answer:
          "Yes, within your plan's batch limit and monthly page allowance. Each statement remains a separate document with its own report.",
      },
      {
        question: "Where are client statements stored?",
        answer:
          "In a private Supabase storage bucket under the account's user id, with row-level ownership policies. Only the owning account can open the PDF or export its rows.",
      },
    ],
    related: [
      "/bank-statement-converter-for-bookkeepers",
      "/convert-bank-statements-to-spreadsheets",
      "/resources/automate-bank-statement-processing-accountants",
      "/convert-bank-statement-pdf-to-excel",
    ],
    updatedAt: "2026-11-18",
  },
  {
    slug: "bank-statement-converter-for-bookkeepers",
    title: "Bank Statement Converter for Bookkeepers",
    description:
      "Turn client PDF statements into a clean ledger for coding and import. Review flagged rows, reconcile balances and export Excel or CSV without retyping transactions.",
    eyebrow: "For bookkeepers",
    h1: "Bank statement converter for bookkeepers",
    intro: [
      "Bookkeeping runs on repetition: the same client, the same bank, the same columns, month after month. When the source is a PDF, that repetition turns into retyping, and retyping turns into reconciliation differences that are hard to trace.",
      "FlowParse converts the statement into a consistent ledger, checks it against the statement's balances, and exports the format you need. You spend the time on coding and queries instead of data entry.",
    ],
    keyPoints: [
      "A stable ledger structure for recurring monthly work.",
      "Separate debit and credit columns that survive an accounting import.",
      "Reconciliation and review flags before you start coding.",
      "Excel and CSV from the same reviewed data.",
    ],
    steps: [
      {
        title: "Upload the client's PDF",
        body: "Digital or scanned, one statement or a batch within your plan's limits.",
      },
      {
        title: "Clear the review flags",
        body: "Check the reconciliation, resolve flagged rows and correct anything the statement made ambiguous.",
      },
      {
        title: "Export and code",
        body: "Download CSV for your accounting tool or Excel for a coding sheet. The column layout stays the same next month.",
      },
    ],
    sections: [
      {
        heading: "When you need the PDF workflow",
        paragraphs: [
          "Bank feeds are excellent when they exist and the client has connected them. They do not cover every situation: a closed account, a legacy statement, a client who will not share bank access, or a period that predates the current software.",
          "The PDF workflow is also useful for one-off checks: a loan application, a landlord's rental accounts, or a set of statements that needs to be reviewed before anything is posted.",
        ],
      },
      {
        heading: "From statement to coded ledger",
        paragraphs: [
          "FlowParse does not categorise transactions or suggest nominal codes. It extracts the transaction fields and leaves the judgement to you. That is intentional: coding rules depend on the client, the chart of accounts and the accounting policy.",
          "What you get is a ledger with consistent descriptions, real dates, positive debit and credit amounts, and a running balance when the statement provides one. That is the input a coding workflow needs.",
        ],
      },
      {
        heading: "A clean import file",
        bullets: [
          "CSV with a stable header row, so an import mapping can be reused.",
          "UTF-8 text for merchant names and currency symbols.",
          "Descriptions quoted when they contain commas or quotes.",
          "Formula-like text neutralised against spreadsheet injection.",
          "Separate debit and credit columns instead of ambiguous signed values.",
        ],
      },
      {
        heading: "Recurring monthly work",
        paragraphs: [
          "The page allowance resets on the first day of each calendar month. A typical bookkeeping client with a two-page statement uses two pages per month; a larger client with several accounts uses more.",
          "Keep one FlowParse document per statement. The history view lets you reopen a month, re-export it, or check what was flagged at the time.",
        ],
      },
      {
        heading: "Quality checks that save time later",
        bullets: [
          "Reconcile the statement before coding. A mismatch is easier to investigate at conversion time than after posting.",
          "Review flagged rows first; they are the most likely source of a later difference.",
          "Check the opening balance against last month's closing balance.",
          "Keep the original PDF attached to the client file.",
        ],
      },
    ],
    audienceHeading: "Bookkeeping work that fits",
    audience: [
      {
        title: "Monthly bookkeeping",
        body: "Convert the same client's statement every month with a stable export layout.",
      },
      {
        title: "Catch-up work",
        body: "Process several months of statements before a deadline.",
      },
      {
        title: "Sole traders",
        body: "Turn personal and business statements into a transaction list for self-assessment preparation.",
      },
      {
        title: "Landlords and rental accounts",
        body: "Extract property income and expenses from statements without bank access.",
      },
    ],
    faq: [
      {
        question: "Does FlowParse categorise transactions?",
        answer:
          "No. It extracts and validates the statement data. Coding and nominal selection stay with the bookkeeper or accountant.",
      },
      {
        question: "Can I reuse an import mapping each month?",
        answer:
          "Yes, if your accounting tool saves mappings. FlowParse keeps the CSV header row stable so the mapping still applies.",
      },
      {
        question: "What if a client sends a photo of a statement?",
        answer:
          "Ask for a PDF. If they only have a photo, convert it to a PDF and expect OCR-quality output; review the confidence flags carefully.",
      },
      {
        question: "Can I process several clients in one day?",
        answer:
          "Yes, within the plan's monthly page allowance. Each statement is a separate document, so client data does not mix within a conversion.",
      },
      {
        question: "Does the Free plan work for real bookkeeping?",
        answer:
          "It is useful for a trial on one short statement: 3 processed pages per month, one file per batch and a 25 MB limit. Recurring client work generally needs Starter or above.",
      },
    ],
    related: [
      "/bank-statement-converter-for-accountants",
      "/convert-bank-statement-pdf-to-csv",
      "/resources/excel-vs-csv-bank-statement-conversion",
      "/convert-bank-statements-to-spreadsheets",
    ],
    updatedAt: "2026-11-18",
  },
  {
    slug: "bank-statement-converter-for-accounting-software",
    title: "Bank Statement Converter for Accounting Software",
    description:
      "Create import-ready CSV files from PDF bank statements: stable columns, normalised dates, positive debit and credit values and safe text.",
    eyebrow: "Accounting imports",
    h1: "Bank statement converter for accounting software",
    intro: [
      "Accounting software is good at importing transactions when the file is predictable. Most import failures are not caused by the software; they are caused by a PDF-derived CSV with mixed date formats, text-formatted amounts or a description that breaks the row.",
      "FlowParse produces a CSV with a stable schema and normalised values, so the import wizard can map columns once and reuse the mapping. It does not post anything into your accounting system and it does not claim a native integration with any package.",
    ],
    keyPoints: [
      "A stable header row for a reusable import mapping.",
      "ISO dates and plain decimal amounts, independent of the statement's locale.",
      "Separate debit and credit columns for unambiguous direction.",
      "CSV and Excel exports from the same reviewed ledger.",
    ],
    steps: [
      {
        title: "Convert the statement",
        body: "Upload the PDF and review the extracted rows. Correct anything flagged before exporting.",
      },
      {
        title: "Map the CSV columns",
        body: "Use your accounting tool's import wizard to map date, description, debit, credit and balance. Save the mapping if the tool supports it.",
      },
      {
        title: "Import and reconcile",
        body: "Import the file, then reconcile the imported total against the statement's closing balance before posting.",
      },
    ],
    sections: [
      {
        heading: "What an accounting import actually needs",
        table: {
          caption: "Import requirements and how FlowParse meets them",
          headers: ["Requirement", "Export behaviour"],
          rows: [
            ["A predictable header row", "Same column names across statements"],
            ["Unambiguous dates", "ISO 8601 (YYYY-MM-DD)"],
            ["Numeric amounts", "Plain decimals with a dot, no currency symbols"],
            ["Transaction direction", "Separate debit and credit columns"],
            ["Safe text", "Commas and quotes escaped; formulas neutralised"],
            ["A reference for reconciliation", "Running balance included when the statement has one"],
          ],
        },
      },
      {
        heading: "Map once, reuse the mapping",
        paragraphs: [
          "Most accounting tools let you save an import profile or mapping. Because FlowParse does not rename columns between statements, the same profile keeps working. The review step happens before the export, so the file you import is the file you checked.",
        ],
      },
      {
        heading: "Dates, decimals and signs",
        paragraphs: [
          "A statement printed in the UK might show 03/04/2026 meaning 3 April. An accounting tool set to US conventions may read it as 4 March. FlowParse normalises dates to ISO format to remove that ambiguity.",
          "Amounts are exported as positive values in separate debit and credit columns. If your tool expects one signed amount column, combine them in a spreadsheet formula before import rather than guessing the tool's sign convention.",
        ],
      },
      {
        heading: "Avoiding duplicate imports",
        bullets: [
          "Import each statement once and keep the original PDF with the workpaper.",
          "Reconcile the imported closing balance before posting.",
          "If an import fails partway, check what the tool actually accepted before retrying the whole file.",
          "Keep the statement period in the file name so an overlap between statements is obvious.",
        ],
      },
      {
        heading: "Tools that accept CSV",
        paragraphs: [
          "FlowParse is not affiliated with any accounting vendor. Its CSV export is intended for software that provides a CSV import wizard, including cloud accounting platforms, desktop bookkeeping packages and spreadsheet-based ledgers.",
          "If your tool requires OFX, QIF or a proprietary format, FlowParse is not the right converter. If it accepts CSV, the import is a mapping exercise rather than a conversion problem.",
        ],
      },
    ],
    audienceHeading: "Where the CSV fits",
    audience: [
      {
        title: "Cloud accounting imports",
        body: "Import historical statement transactions into a cloud ledger.",
      },
      {
        title: "Desktop bookkeeping",
        body: "Feed a desktop package that accepts CSV transaction files.",
      },
      {
        title: "Spreadsheet ledgers",
        body: "Append a normalised month to an Excel-based bookkeeping file.",
      },
      {
        title: "Data migration",
        body: "Move historical transactions into a new system during a software change.",
      },
    ],
    faq: [
      {
        question: "Does FlowParse integrate directly with Xero or QuickBooks?",
        answer:
          "No. There is no native integration and no FlowParse app in those marketplaces. FlowParse exports CSV, which those tools can import through their own import wizards.",
      },
      {
        question: "Which CSV format does it use?",
        answer:
          "UTF-8, comma-delimited, with a header row and one transaction per line. Fields containing commas, quotes or line breaks are quoted and escaped.",
      },
      {
        question: "Can I get a single signed amount instead of debit and credit?",
        answer:
          "The export separates debit and credit to avoid sign conventions. If your importer needs one column, combine them in a spreadsheet formula before importing.",
      },
      {
        question: "Will the import duplicate transactions already in the ledger?",
        answer:
          "Your accounting tool decides that. Import only statements that are not already in the ledger, and reconcile the closing balance after each import.",
      },
      {
        question: "Can I import a scanned statement?",
        answer:
          "Yes, after review. Scanned statements use OCR and are flagged, so clear the review notes before exporting to your accounting software.",
      },
    ],
    related: [
      "/convert-bank-statement-pdf-to-csv",
      "/bank-statement-converter-for-bookkeepers",
      "/bank-statement-converter-for-accountants",
      "/resources/excel-vs-csv-bank-statement-conversion",
    ],
    updatedAt: "2026-11-18",
  },
];
