import type { LandingPageContent } from "@/lib/seo/content-types";

export const conversionLandingPages: LandingPageContent[] = [
  {
    slug: "convert-bank-statement-pdf-to-excel",
    title: "Convert a Bank Statement PDF to Excel",
    description:
      "Turn a PDF bank statement into an Excel ledger with dated transactions, descriptions, amounts and balances. Review flagged rows, then export.",
    eyebrow: "PDF to Excel",
    h1: "Convert a bank statement PDF to Excel",
    intro: [
      "A bank statement PDF is built to look right on paper, not to be analysed. Excel wants one row per transaction, a real date in every date cell, and debits and credits in separate columns. The gap between those two formats is where most statement work happens.",
      "FlowParse reads the PDF, rebuilds the transaction table, checks the running balance, and gives you a workbook you can review before you export. It handles statements with a text layer and scanned pages that need OCR, and it tells you when a row is uncertain instead of quietly inventing a value.",
    ],
    keyPoints: [
      "One row per transaction with date, value date, reference, description, debit, credit and balance.",
      "Opening and closing balances reconciled against the rows FlowParse extracted.",
      "Ambiguous dates, currencies, amounts and duplicates are flagged for review.",
      "Digital and scanned PDFs use the same workflow, with a free allowance to test a statement.",
    ],
    steps: [
      {
        title: "Upload the statement PDF",
        body: "Create a free account and upload the PDF. Files are stored in a private bucket scoped to your account, and the browser uploads directly with a short-lived signed URL.",
      },
      {
        title: "Review the extracted rows",
        body: "FlowParse shows the ledger it reconstructed, the reconciliation result and any rows that need a second look. Edit a description, date or amount directly in the table.",
      },
      {
        title: "Export the Excel workbook",
        body: "Download a formatted XLSX file with a statement summary, reconciliation details, the transaction ledger, value dates and review notes.",
      },
    ],
    sections: [
      {
        heading: "What the Excel file contains",
        paragraphs: [
          "The workbook is designed for analysis, not as a visual replica of the PDF. Each transaction becomes a row, and the columns stay consistent across statements so you can append one month to the next without reworking the sheet.",
        ],
        table: {
          caption: "Transaction columns in the exported workbook",
          headers: ["Column", "What it holds"],
          rows: [
            ["Transaction date", "The posting date, normalised to a real spreadsheet date"],
            ["Value date", "The value date when the statement provides a separate one"],
            ["Description", "The transaction narrative with statement line breaks collapsed"],
            ["Reference", "A cheque, transfer or payment reference when the statement includes one"],
            ["Debit / Credit", "Separate columns so amounts stay positive and direction stays explicit"],
            ["Balance", "The running balance after the transaction, when the statement shows one"],
            ["Currency", "A per-row currency when the statement includes more than one"],
            ["Review note", "The reason a row was flagged, when it needs attention"],
          ],
        },
      },
      {
        heading: "Why copying from a PDF into Excel breaks",
        bullets: [
          "A copied PDF line often arrives as one text cell, so dates and amounts need to be split by hand.",
          "Negative amounts may paste as text, which breaks sums and pivot tables.",
          "Multi-line descriptions become extra rows, shifting every later transaction.",
          "Page headers, footers and page numbers land in the middle of the data.",
          "Scanned statements have no selectable text at all, so copy-and-paste returns nothing.",
        ],
        paragraphs: [
          "A converter avoids those problems by rebuilding the table from the document's geometry and text, then validating the result against the statement's own opening and closing balances.",
        ],
      },
      {
        heading: "Digital statements, scanned statements, and OCR",
        paragraphs: [
          "Digital statements carry a text layer. FlowParse extracts words and positions directly, which is fast and precise. Scanned statements are images, so the processor renders each page and runs OCR before parsing. OCR is slower and less certain, so any page that relies on it is marked and its rows are reviewable.",
          "The extraction engine uses conservative bank profiles for several UK, US and Australian banks. A profile changes defaults such as currency and date order; evidence in the document always wins. If a layout is unfamiliar, FlowParse reports unresolved lines instead of fabricating transactions.",
        ],
      },
      {
        heading: "What to check before you rely on the numbers",
        bullets: [
          "The opening balance plus credits minus debits should equal the closing balance. FlowParse shows this reconciliation for every statement.",
          "Look at the count of flagged rows. A clean statement should have none or very few.",
          "Spot-check the first and last transaction against the PDF, especially on scanned pages.",
          "If you edited rows, re-check the reconciliation before exporting.",
        ],
      },
      {
        heading: "When a PDF-to-Excel converter is the wrong tool",
        paragraphs: [
          "If you have direct bank feeds in your accounting software, use those for day-to-day bookkeeping; they are more complete than a monthly PDF. If you need the visual statement preserved for an audit file, keep the original PDF alongside the workbook.",
          "A converter is the right tool when the statement only exists as a PDF, when the client cannot share a bank feed, or when you need a transaction table for analysis outside the accounting system.",
        ],
      },
    ],
    audienceHeading: "Who uses PDF-to-Excel conversion",
    audience: [
      {
        title: "Bookkeepers",
        body: "Turn client statements into a ledger you can code and import without retyping a month of transactions.",
      },
      {
        title: "Accountants",
        body: "Produce consistent working papers for month-end, loan applications and audits.",
      },
      {
        title: "Finance teams",
        body: "Consolidate statements from several accounts into one analysis-ready sheet.",
      },
      {
        title: "Individuals",
        body: "Get a clean transaction list for a mortgage application, expense claim or personal budget.",
      },
    ],
    faq: [
      {
        question: "Does this work with password-protected bank statements?",
        answer:
          "No. FlowParse rejects encrypted PDFs with a clear error rather than guessing at the contents. Open the statement with your bank's password, save or print an unprotected copy, and upload that.",
      },
      {
        question: "Will the Excel file look exactly like the PDF?",
        answer:
          "No. The export is a data workbook with one row per transaction, not a visual copy of the statement. That is deliberate: a clean table is what Excel formulas, pivot tables and accounting imports need.",
      },
      {
        question: "Can I convert a scanned bank statement to Excel?",
        answer:
          "Yes. Scanned pages are rendered and processed with OCR, then parsed like a digital statement. OCR pages are marked, and low-confidence rows are flagged so you can review them before exporting.",
      },
      {
        question: "How many statements can I convert for free?",
        answer:
          "The Free plan includes 3 processed pages per month, one PDF per upload batch and a 25 MB file limit. Paid plans raise the monthly page allowance and batch size.",
      },
      {
        question: "Are my bank statements stored permanently?",
        answer:
          "Statements are stored privately in your account so you can review and re-export them. You can delete a statement at any time, which removes the document record and attempts to remove the stored PDF.",
      },
    ],
    related: [
      "/convert-bank-statement-pdf-to-csv",
      "/convert-scanned-bank-statement-to-excel",
      "/resources/how-to-convert-bank-statement-pdf-to-excel",
      "/bank-statement-converter-for-accountants",
    ],
    updatedAt: "2026-11-18",
  },
  {
    slug: "convert-bank-statement-pdf-to-csv",
    title: "Convert a Bank Statement PDF to CSV",
    description:
      "Create an import-ready CSV from a PDF bank statement: separate debit and credit columns, normalised dates and safe text fields. Review, then export.",
    eyebrow: "PDF to CSV",
    h1: "Convert a bank statement PDF to CSV",
    intro: [
      "CSV is the format that moves data between systems. It is what accounting imports, expense tools and data pipelines expect. It is also unforgiving: one misplaced comma, one text-formatted amount or one locale-specific date can break an import before it starts.",
      "FlowParse turns a bank statement PDF into a consistent CSV with explicit columns and normalised values. You review the extracted rows first, then download a file designed to be parsed rather than admired.",
    ],
    keyPoints: [
      "UTF-8 CSV with a stable header row you can map once and reuse.",
      "Separate debit and credit columns so values stay positive and direction is unambiguous.",
      "Descriptions containing commas, quotes and line breaks are quoted correctly.",
      "Spreadsheet formulas in statement text are neutralised so a CSV cannot execute them.",
    ],
    steps: [
      {
        title: "Upload the PDF statement",
        body: "Create an account and upload the statement. Digital and scanned PDFs are both accepted; scans are processed with OCR and flagged accordingly.",
      },
      {
        title: "Check the ledger and reconciliation",
        body: "Confirm the row count, opening and closing balances, and review any flagged rows. Fix the source row in the editor if something looks wrong.",
      },
      {
        title: "Download the CSV",
        body: "Export the same reviewed data as CSV. The header row is stable, so a mapping you create for one statement works for the next.",
      },
    ],
    sections: [
      {
        heading: "What a good bank statement CSV looks like",
        paragraphs: [
          "The exact columns depend on the statement, but a useful export keeps direction explicit and avoids mixing presentation with data. FlowParse uses one row per transaction and separate debit and credit columns.",
        ],
        table: {
          caption: "Typical CSV columns",
          headers: ["Column", "Example"],
          rows: [
            ["date", "2026-10-31"],
            ["value_date", "2026-10-31"],
            ["description", "CARD PAYMENT COFFEE SHOP"],
            ["reference", "TXN-88421"],
            ["debit", "12.40"],
            ["credit", ""],
            ["balance", "1840.22"],
            ["currency", "GBP"],
          ],
        },
      },
      {
        heading: "CSV details that decide whether an import works",
        bullets: [
          "Encoding: UTF-8 keeps currency symbols and non-ASCII merchant names intact.",
          "Delimiter: commas are the default. Fields containing commas are wrapped in quotes, and quotes inside a field are escaped.",
          "Dates: ISO 8601 (YYYY-MM-DD) is unambiguous. Locale dates such as 03/04/2026 mean different things in different countries.",
          "Amounts: values are plain decimals with a dot, not strings with thousands separators or currency symbols.",
          "Direction: separate debit and credit columns avoid negative-number conventions that some importers reverse.",
          "Formula injection: cells starting with =, +, - or @ are neutralised so a spreadsheet cannot treat statement text as a formula.",
        ],
      },
      {
        heading: "CSV or Excel? Choose by destination",
        paragraphs: [
          "Choose CSV when the next stop is an accounting import, a database, a script or a tool that asks for CSV. Choose Excel when a person will read, format, filter or annotate the file, or when you need more than one sheet. The data is the same; only the container changes.",
          "FlowParse can export both formats from the same reviewed statement, so you do not need to convert twice. See [Excel vs CSV for bank statement conversion](/resources/excel-vs-csv-bank-statement-conversion) for a longer comparison.",
        ],
      },
      {
        heading: "Importing the CSV into accounting software",
        paragraphs: [
          "Most accounting tools let you map CSV columns during import. Map the date, description, amount and balance columns once, then reuse the mapping. If your tool expects a single signed amount column, combine debit and credit in a spreadsheet formula before import.",
          "FlowParse does not connect to your accounting software and does not claim a native integration. It produces a clean CSV that tools accepting CSV can import.",
        ],
      },
      {
        heading: "What to verify before importing",
        bullets: [
          "The reconciliation matches the statement's opening and closing balances.",
          "The date range covers the statement period without gaps at page boundaries.",
          "The row count matches the statement's transaction count, or flagged rows explain the difference.",
          "Your accounting tool's locale matches the CSV date format.",
        ],
      },
    ],
    audienceHeading: "Where CSV exports fit",
    audience: [
      {
        title: "Accounting imports",
        body: "Feed a bookkeeping or accounting tool that accepts a transaction CSV.",
      },
      {
        title: "Data analysis",
        body: "Load statements into a database, notebook or BI tool with predictable columns.",
      },
      {
        title: "Expense and audit tools",
        body: "Hand a client a portable file that opens anywhere without conversion.",
      },
      {
        title: "Automation",
        body: "Join monthly exports into a pipeline without parsing a PDF again.",
      },
    ],
    faq: [
      {
        question: "Will the CSV open in Excel?",
        answer:
          "Yes. Excel opens CSV files directly. Use Data > From Text/CSV if your regional settings use a different list separator, so the columns are split correctly.",
      },
      {
        question: "Are amounts stored as numbers or text?",
        answer:
          "Amounts are written as plain decimals in the file. When Excel opens a CSV it may apply local formatting; import through Data > From Text/CSV and set the amount columns to numeric if you need formulas immediately.",
      },
      {
        question: "Can descriptions contain commas?",
        answer:
          "Yes. Fields containing commas, quotes or line breaks are quoted and escaped so the row structure stays intact.",
      },
      {
        question: "Does the CSV include a running balance?",
        answer:
          "When the statement prints a running balance, the export includes it. If the statement does not show one, the column is empty rather than calculated.",
      },
      {
        question: "Is CSV safer than Excel for sharing?",
        answer:
          "CSV cannot carry macros, so it is simpler to inspect. It also has no formatting, formulas or multiple sheets. Neither format is encrypted; share files through a secure channel.",
      },
    ],
    related: [
      "/convert-bank-statement-pdf-to-excel",
      "/pdf-transaction-extractor",
      "/resources/excel-vs-csv-bank-statement-conversion",
      "/bank-statement-converter-for-accounting-software",
    ],
    updatedAt: "2026-11-18",
  },
  {
    slug: "convert-scanned-bank-statement-to-excel",
    title: "Convert a Scanned Bank Statement to Excel",
    description:
      "Convert scanned or image-only bank statements into an Excel ledger using OCR, with page-level confidence flags and a review step before you export.",
    eyebrow: "Scanned statements",
    h1: "Convert a scanned bank statement to Excel",
    intro: [
      "Scanned statements are images of paper. There is no text to select, so copy-and-paste returns nothing and a normal PDF parser sees a blank page. Converting one means recognising the characters first, then rebuilding the transaction table from their positions.",
      "FlowParse detects pages without a usable text layer, renders them, runs OCR, and parses the result. Because OCR can misread a digit or a decimal point, scanned pages are marked and uncertain rows are flagged for review rather than exported as if they were certain.",
    ],
    keyPoints: [
      "Automatic detection of image-only pages, with OCR only where the text layer is missing.",
      "Page-level OCR confidence so you know which pages need a closer look.",
      "Flagged rows for low-confidence text, ambiguous dates and amount problems.",
      "The same Excel and CSV exports as a digital statement, after review.",
    ],
    steps: [
      {
        title: "Upload the scanned PDF",
        body: "Upload a PDF scan of the statement. Keep the scan straight and reasonably high resolution; 300 DPI is a good target. FlowParse rejects encrypted files, so remove password protection first.",
      },
      {
        title: "Let OCR and parsing run",
        body: "Pages without enough text are rendered and recognised. Progress is reported per stage, and the processor caps confidence for any statement that relies on OCR.",
      },
      {
        title: "Review flagged rows, then export",
        body: "Compare the flagged rows with the scan, correct anything OCR misread, confirm the reconciliation, and download the workbook.",
      },
    ],
    sections: [
      {
        heading: "Why scanned statements need a different pipeline",
        bullets: [
          "There is no embedded text, so extraction starts with optical character recognition.",
          "Skew, shadows and low resolution change how characters are recognised.",
          "Decimal points and digit shapes such as 3/8 or 1/7 are common OCR confusions.",
          "Multi-column layouts can interleave if the OCR engine reads in the wrong order.",
          "A confident-looking wrong digit is worse than a flagged row, which is why confidence is surfaced.",
        ],
      },
      {
        heading: "How FlowParse handles OCR",
        paragraphs: [
          "The processor checks the amount of usable text on each page. Digital pages are read directly. Pages that do not contain enough text are rendered at 300 DPI and passed to Tesseract, with word-level confidence retained.",
          "Rows that come from OCR are never presented as a clean digital read. A mean page confidence below 65% marks the page low confidence, flags its rows and forces the statement's overall confidence to low. Any OCR page caps the statement at medium confidence.",
        ],
      },
      {
        heading: "Getting the best result from a scan",
        bullets: [
          "Scan at 300 DPI or higher, straight, with the whole page visible.",
          "Prefer a greyscale or colour scan over a heavily compressed black-and-white copy.",
          "Avoid photographing a screen; moiré patterns confuse OCR.",
          "If the statement is available as a digital PDF, upload that instead. It is faster and more accurate.",
          "Crop out irrelevant pages only if you are comfortable editing the PDF; otherwise upload the statement as issued.",
        ],
      },
      {
        heading: "What to check on a scanned conversion",
        bullets: [
          "Every page is represented, including pages where the statement repeats a header.",
          "Opening and closing balances reconcile.",
          "Rows flagged for low OCR confidence match the image.",
          "Dates near the start and end of the period are correct, especially around month boundaries.",
          "Decimal values look plausible for the account, not shifted by a factor of ten.",
        ],
      },
      {
        heading: "When OCR is not enough",
        paragraphs: [
          "A poor scan can produce a partial extraction. FlowParse marks the document as needing review or failed and lists the source lines it could not parse, so you can enter those rows manually instead of trusting a guess.",
          "If a statement is handwritten, heavily creased or missing pages, OCR may not be reliable. In that case, request a digital copy from the bank or enter the missing transactions by hand.",
        ],
      },
    ],
    audienceHeading: "Common scanned-statement situations",
    audience: [
      {
        title: "Clients send photos",
        body: "A client photographs a statement and sends a PDF; OCR is the only way to reach the data.",
      },
      {
        title: "Archive copies",
        body: "Statements were printed and scanned years ago, and the digital original is gone.",
      },
      {
        title: "Bank portals",
        body: "The bank only provides an image-based PDF for a closed or legacy account.",
      },
      {
        title: "Audit packs",
        body: "A bundle mixes digital statements with scanned pages from another source.",
      },
    ],
    faq: [
      {
        question: "Can I upload a photo of a bank statement?",
        answer:
          "Upload a PDF. If your phone produces an image, convert it to a PDF first, but a flat scan is more reliable than a photograph. FlowParse processes PDFs only.",
      },
      {
        question: "How accurate is OCR on bank statements?",
        answer:
          "It depends on scan quality and layout. FlowParse reports confidence per document and per page, flags low-confidence rows, and marks OCR output so it is never presented as a certain digital read. Treat flagged rows as work to review, not as validated data.",
      },
      {
        question: "Does OCR support every language?",
        answer:
          "English is the packaged OCR language. Statements in other languages may be recognised only where the text layer contains extractable text.",
      },
      {
        question: "Will the export include scanned pages I did not review?",
        answer:
          "The export includes the reviewed ledger. If a page produced low-confidence rows, they remain in the ledger with review notes so you can fix them before using the numbers.",
      },
      {
        question: "Is there a page limit?",
        answer:
          "The processor caps a PDF at 100 pages, and each plan has a monthly processed-page allowance. The Free plan includes 3 processed pages per month.",
      },
    ],
    related: [
      "/bank-statement-ocr",
      "/convert-bank-statement-pdf-to-excel",
      "/resources/convert-scanned-bank-statements-ocr",
      "/pdf-transaction-extractor",
    ],
    updatedAt: "2026-11-18",
  },
];
