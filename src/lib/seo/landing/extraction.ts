import type { LandingPageContent } from "@/lib/seo/content-types";

export const extractionLandingPages: LandingPageContent[] = [
  {
    slug: "bank-statement-ocr",
    title: "Bank Statement OCR for Scanned Statements",
    description:
      "OCR for scanned bank statements: detect image-only pages, rebuild transaction rows and keep confidence visible so uncertain data is reviewed.",
    eyebrow: "OCR",
    h1: "Bank statement OCR, with the uncertainty left visible",
    intro: [
      "OCR turns pixels into characters. That is only half of a bank statement conversion. The harder part is deciding which characters form a date, which form an amount, and which belong to a page header that should never become a transaction.",
      "FlowParse uses OCR only where a PDF page has no usable text layer, keeps word-level confidence, and flags the rows that depend on a low-confidence read. You get the speed of automation without pretending that a blurry scan is as reliable as a digital statement.",
    ],
    keyPoints: [
      "Page-level detection decides whether OCR is needed at all.",
      "300 DPI rendering with Tesseract and English language data.",
      "Low-confidence pages flag their rows and force a low overall confidence.",
      "OCR output is capped at medium confidence, even when the page looks clean.",
    ],
    steps: [
      {
        title: "Check the text layer",
        body: "FlowParse first tries to read embedded text. Pages with enough usable text skip OCR entirely, which is faster and more accurate.",
      },
      {
        title: "Render and recognise image-only pages",
        body: "A page without a text layer is rendered at 300 DPI and processed with OCR. Word positions and confidence are retained for the parser.",
      },
      {
        title: "Parse, validate and review",
        body: "The parser rebuilds rows from word geometry, reconciles balances, and marks low-confidence rows for review before export.",
      },
    ],
    sections: [
      {
        heading: "What OCR does with a bank statement",
        paragraphs: [
          "OCR analyses an image and returns characters with bounding boxes. In a statement, those characters include transaction dates, descriptions, references, debit and credit amounts, running balances, page headers and legal footers.",
          "The parser then groups words into lines, finds the table's column anchors, and assigns each token to a field. Without that second step, OCR output is just a wall of text with no reliable transaction boundaries.",
        ],
      },
      {
        heading: "OCR versus a text-layer PDF",
        table: {
          caption: "Why digital statements are handled differently",
          headers: ["", "Digital PDF", "Scanned PDF"],
          rows: [
            ["Text source", "Embedded characters", "Pixels recognised by OCR"],
            ["Speed", "Fast", "Slower: rendering and recognition per page"],
            ["Certainty", "High when the text layer is clean", "Depends on scan quality"],
            ["Typical problems", "Unusual layouts, split columns", "Blur, skew, decimal confusion"],
            ["FlowParse handling", "Direct extraction", "OCR plus confidence flags"],
          ],
        },
      },
      {
        heading: "How confidence is reported",
        paragraphs: [
          "Every OCR word carries a confidence score. FlowParse aggregates it per page. A page with a mean confidence below 65% is marked low confidence: every row from that page is flagged and the statement's confidence is forced to low.",
          "Any statement that uses OCR is capped at medium confidence overall. That is deliberate. A clean-looking scan can still misread a single digit, and the difference between 1,480.00 and 1,460.00 matters more than the visual quality of the page.",
        ],
      },
      {
        heading: "What OCR cannot fix",
        bullets: [
          "Handwritten statements, annotations and signatures are not reliable OCR targets.",
          "Heavily compressed scans lose the thin strokes that separate 3 from 8 and 1 from 7.",
          "Pages photographed at an angle need deskewing that OCR alone does not perform.",
          "A missing page cannot be reconstructed from the remaining pages.",
          "Statements with a mixed language are limited by the installed English OCR data.",
        ],
        paragraphs: [
          "When extraction is not reliable, FlowParse marks the document as needing review or failed and reports the source lines it could not resolve. Manual entry remains available, which is better than a plausible-looking wrong ledger.",
        ],
      },
      {
        heading: "Privacy and retention",
        paragraphs: [
          "Statements are uploaded to a private storage bucket under your user id. The processor downloads a statement with service-role credentials, extracts it, and writes results back through a service-role-only function. The browser never receives the service-role key.",
          "OCR runs on your statement in the processor service; it does not send pages to a third-party OCR API. You can delete a statement from the workspace, which removes its database record and attempts to remove the stored PDF.",
        ],
      },
    ],
    audienceHeading: "When bank statement OCR helps",
    audience: [
      {
        title: "Legacy statements",
        body: "The only available copy is a scan from an old filing cabinet or archive.",
      },
      {
        title: "Client uploads",
        body: "Clients photograph or scan statements instead of downloading them from a bank.",
      },
      {
        title: "Mixed batches",
        body: "Some pages are digital and others are scanned, and you need one consistent ledger.",
      },
      {
        title: "Audit preparation",
        body: "You need the transactions as data, but the source only exists as images.",
      },
    ],
    faq: [
      {
        question: "Does every page go through OCR?",
        answer:
          "No. FlowParse reads the embedded text layer first and only renders pages that do not contain enough usable text. Digital pages are extracted directly.",
      },
      {
        question: "What OCR engine and language are used?",
        answer:
          "Tesseract 5 with English language data, running inside the FlowParse processor. Additional languages require installing the corresponding Tesseract data files.",
      },
      {
        question: "Can OCR read a photo of a statement?",
        answer:
          "It can process a PDF built from a photo, but results depend on lighting, angle and resolution. A flat 300 DPI scan is much more reliable. FlowParse accepts PDFs only.",
      },
      {
        question: "How do I know which rows came from OCR?",
        answer:
          "OCR pages are marked in the extraction report, confidence is shown for the statement, and low-confidence pages flag every row they produced with review reasons.",
      },
      {
        question: "Is OCR data sent to a third party?",
        answer:
          "No. Recognition runs in the FlowParse processor using a local Tesseract installation. Statement pages are not forwarded to an external OCR service.",
      },
    ],
    related: [
      "/convert-scanned-bank-statement-to-excel",
      "/resources/convert-scanned-bank-statements-ocr",
      "/convert-bank-statement-pdf-to-excel",
      "/pdf-transaction-extractor",
    ],
    updatedAt: "2026-11-18",
  },
  {
    slug: "pdf-transaction-extractor",
    title: "PDF Transaction Extractor for Bank Statements",
    description:
      "Extract dates, descriptions, references, debits, credits and running balances from PDF bank statements into a reviewable ledger exported to Excel or CSV.",
    eyebrow: "Transaction extraction",
    h1: "PDF transaction extractor for bank statements",
    intro: [
      "A statement PDF contains the transactions you need, but not in rows a computer can use. Descriptions wrap across lines, amounts sit in separate columns, and page furniture repeats in the middle of the table.",
      "FlowParse extracts the transaction fields, rebuilds the rows, and validates them against the statement's own balances. The result is a structured ledger rather than a text dump, with review notes where the document was ambiguous.",
    ],
    keyPoints: [
      "Transaction date, value date, description, reference, debit, credit, balance and currency.",
      "Rows reconstructed from text geometry, not from naive line splitting.",
      "Opening and closing balance reconciliation on every statement.",
      "Source lines that cannot be resolved are reported instead of discarded.",
    ],
    steps: [
      {
        title: "Read the document structure",
        body: "The extractor reads words and their positions, detects page rotation, and identifies the transaction table and its column headers.",
      },
      {
        title: "Extract and normalise fields",
        body: "Dates, amounts and currencies are parsed with locale-aware rules, while descriptions keep their text but lose layout artefacts.",
      },
      {
        title: "Validate before you use the data",
        body: "Running balances, duplicate rows and row completeness are checked. Anything uncertain is flagged and kept for review.",
      },
    ],
    sections: [
      {
        heading: "What gets extracted",
        table: {
          caption: "Transaction fields",
          headers: ["Field", "Source in the statement"],
          rows: [
            ["Transaction date", "The posting date column or inline date"],
            ["Value date", "A separate value-date column or label"],
            ["Description", "The transaction narrative, including wrapped lines"],
            ["Reference", "Cheque, transfer or payment reference"],
            ["Debit / Credit", "Separate amount columns, DR/CR markers or sign"],
            ["Balance", "The running balance column"],
            ["Currency", "An ISO code, symbol or per-row currency"],
          ],
        },
      },
      {
        heading: "How rows are reconstructed",
        paragraphs: [
          "PDF text arrives as individual words with coordinates. FlowParse builds geometric lines from those words, finds the table anchors, and decides which horizontal band belongs to one transaction. A description that wraps onto a second line is merged with its parent row instead of becoming a new transaction.",
          "When a statement has no header row, the parser falls back to layout inference using date and amount positions. That fallback is conservative: if the structure is not clear, the affected lines are reported as unresolved rather than guessed.",
        ],
      },
      {
        heading: "Debits, credits and running balances",
        paragraphs: [
          "Some statements use separate debit and credit columns. Others use a single amount column with DR/CR markers, a minus sign or parentheses. FlowParse uses the document's headers and markers first, then the running balance to infer direction when the layout is ambiguous.",
          "A running balance is also a validation signal. If the balance jumps in a way that the extracted amount does not explain, the row is flagged for review.",
        ],
      },
      {
        heading: "Validation checks",
        bullets: [
          "Opening balance plus credits minus debits equals the stated closing balance.",
          "Each row has a date, a description and at least one amount.",
          "Consecutive running balances agree with the transactions between them.",
          "Potential duplicates are detected by date, description and amount.",
          "Ambiguous dates, currencies and amounts are flagged instead of silently chosen.",
        ],
      },
      {
        heading: "What you can do with the extracted ledger",
        paragraphs: [
          "Review and edit the rows in the workspace, then export to Excel for analysis or CSV for an import. Extracted statements remain available in your history, so you can revisit a month without re-uploading the PDF.",
          "If you need the original document, FlowParse keeps the PDF in private storage and streams it back only to the owning account.",
        ],
      },
    ],
    audienceHeading: "Extraction use cases",
    audience: [
      {
        title: "Financial analysis",
        body: "Build a transaction dataset for cash-flow analysis, forecasting or category reporting.",
      },
      {
        title: "Audit and investigation",
        body: "Turn a stack of statements into a searchable, sortable ledger.",
      },
      {
        title: "Expense review",
        body: "Find recurring payments and unusual debits across several months.",
      },
      {
        title: "Data migration",
        body: "Move historical statement data into a new system that accepts CSV.",
      },
    ],
    faq: [
      {
        question: "Does the extractor work on scanned PDFs?",
        answer:
          "Yes. Scanned pages are processed with OCR first, then the same extractor runs. OCR pages are marked and their rows are subject to confidence flags.",
      },
      {
        question: "Can it extract from a statement with no table headers?",
        answer:
          "It attempts layout inference from date and amount positions. If the structure is too ambiguous, the affected lines are reported as unresolved rather than turned into invented rows.",
      },
      {
        question: "Does it calculate a balance if the statement omits one?",
        answer:
          "No. The balance column is populated only when the statement shows a running balance. FlowParse does not fabricate a balance it cannot verify.",
      },
      {
        question: "Can I edit extracted transactions?",
        answer:
          "Yes. The workspace editor supports updating a row, adding a manual row and deleting a row. Edits are saved through a security-invoker function under your account's permissions.",
      },
      {
        question: "What export formats are available?",
        answer:
          "Excel (XLSX) and CSV. Both use the reviewed ledger, so what you corrected in the workspace is what you export.",
      },
    ],
    related: [
      "/convert-bank-statement-pdf-to-excel",
      "/bank-statement-ocr",
      "/convert-bank-statements-to-spreadsheets",
      "/resources/extract-transactions-from-pdf-bank-statement",
    ],
    updatedAt: "2026-11-18",
  },
  {
    slug: "convert-bank-statements-to-spreadsheets",
    title: "Convert Bank Statements to Spreadsheets",
    description:
      "Convert one statement or a batch of PDF bank statements into consistent Excel or CSV spreadsheets, with page-based allowances and balance reconciliation.",
    eyebrow: "Spreadsheet conversion",
    h1: "Convert bank statements to spreadsheets",
    intro: [
      "A spreadsheet is only useful if the data inside it is consistent. Statements from different months, accounts or banks can use different date orders, amount conventions and column layouts. Appending them without normalising produces a sheet that looks complete but cannot be summed reliably.",
      "FlowParse normalises each statement into the same transaction structure, reconciles the balances, and exports Excel or CSV. It is a conversion workflow, not a bank feed: you keep the original PDFs, and you decide what to do with the structured data.",
    ],
    keyPoints: [
      "Excel and CSV exports from the same reviewed ledger.",
      "Consistent columns across statements, so months can be appended.",
      "Page-based allowances: 3 pages free, 100 on Starter, 400 on Pro, unlimited on Business.",
      "Batch limits from 1 file on Free to 10 files on Pro and Business.",
    ],
    steps: [
      {
        title: "Choose the statements",
        body: "Upload a batch of PDFs within your plan's file limit. Digital and scanned statements can be mixed in the same batch.",
      },
      {
        title: "Review each conversion",
        body: "Every statement gets its own reconciliation and review flags. Fix rows in the workspace before exporting.",
      },
      {
        title: "Export to Excel or CSV",
        body: "Download one format, or both, from the same data. Use Excel for analysis and CSV for imports.",
      },
    ],
    sections: [
      {
        heading: "Pick the output by what happens next",
        table: {
          caption: "Excel or CSV",
          headers: ["If the next step is…", "Use", "Why"],
          rows: [
            ["A person reviewing or formatting the data", "Excel", "Multiple sheets, formatting, filters, formulas"],
            ["An accounting import", "CSV", "Predictable, text-based and widely supported"],
            ["A database or script", "CSV", "Simple to parse and diff"],
            ["A pivot table or financial model", "Excel", "Native numeric cells and formulas"],
            ["A client hand-off", "Excel", "Readable without an import step"],
          ],
        },
      },
      {
        heading: "Batch conversion without losing track",
        paragraphs: [
          "Each PDF becomes its own document with its own extraction report. A batch does not merge statements into one anonymous table, so you can see which rows came from which file. Export per statement, then combine in a spreadsheet if you need a consolidated view.",
          "Batch size depends on your plan: 1 file on Free, 5 on Starter, 10 on Pro and Business. The monthly allowance counts processed pages, not files, so a long statement consumes more of the allowance.",
        ],
      },
      {
        heading: "Which statements work",
        bullets: [
          "Digital PDFs with a text layer: the most reliable input.",
          "Scanned PDFs: OCR is used and the result is marked and reviewable.",
          "Statements with separate debit and credit columns, or a single signed amount.",
          "Headerless layouts, with conservative inference and unresolved-line reporting.",
          "UK, US and Australian statement conventions, plus generic international layouts.",
        ],
        paragraphs: [
          "Unsupported or corrupt files fail with an explanation rather than a partial silent result. Password-protected PDFs must be unlocked before upload.",
        ],
      },
      {
        heading: "The spreadsheet structure",
        paragraphs: [
          "Each export includes a statement summary, reconciliation details, the transaction ledger and an extraction report. The ledger uses one row per transaction with separate debit and credit columns, a balance column when the statement provides one, and review notes for flagged rows.",
          "This structure is intentionally boring. A stable schema is what lets you reuse a pivot table, an import mapping or a formula from one month to the next.",
        ],
      },
      {
        heading: "From statement to close",
        paragraphs: [
          "For bookkeeping, export CSV and import into your accounting tool with a saved column mapping. For analysis, export Excel and append the month to a model. For audit work, keep the original PDF alongside the workbook and the extraction report.",
          "If you need bank-specific notes, see the bank pages for [Barclays](/banks/barclays) and [Chase](/banks/chase), or start with [PDF to Excel](/convert-bank-statement-pdf-to-excel) if you are converting a single statement.",
        ],
      },
    ],
    audienceHeading: "Teams that convert statements in batches",
    audience: [
      {
        title: "Accounting practices",
        body: "Process client statements at month-end without asking clients for a different export.",
      },
      {
        title: "Bookkeepers",
        body: "Turn PDFs into a ledger that can be coded and imported.",
      },
      {
        title: "Finance operations",
        body: "Consolidate multiple accounts into a consistent monthly dataset.",
      },
      {
        title: "Analysts",
        body: "Build a comparable transaction history from documents that only exist as PDFs.",
      },
    ],
    faq: [
      {
        question: "Can I convert several statements at once?",
        answer:
          "Yes, within your plan's batch limit. Each statement stays a separate document with its own report, so you always know which rows came from which PDF.",
      },
      {
        question: "Do you merge multiple statements into one spreadsheet?",
        answer:
          "No. Each statement exports separately. That keeps the reconciliation and review notes attached to the right document. You can combine the exports in Excel afterwards.",
      },
      {
        question: "What counts against the monthly allowance?",
        answer:
          "Processed pages. A 12-page statement uses 12 pages of the allowance; re-exporting an already processed statement does not use more pages.",
      },
      {
        question: "Can I convert a statement for accounting software?",
        answer:
          "Yes. FlowParse produces a CSV with a stable header row. Your accounting tool's import wizard maps the columns; FlowParse does not claim native integrations with specific packages.",
      },
      {
        question: "Is there a file-size limit?",
        answer:
          "PDFs are limited to 25 MB in the app, and the processor caps a document at 100 pages.",
      },
    ],
    related: [
      "/convert-bank-statement-pdf-to-excel",
      "/convert-bank-statement-pdf-to-csv",
      "/bank-statement-converter-for-accountants",
      "/bank-statement-converter-for-accounting-software",
    ],
    updatedAt: "2026-11-18",
  },
];
