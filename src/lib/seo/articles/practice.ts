import type { ArticleContent } from "@/lib/seo/content-types";

export const practiceArticles: ArticleContent[] = [
  {
    slug: "extract-transactions-from-pdf-bank-statement",
    title: "How to Extract Transactions from a PDF Bank Statement",
    description:
      "Understand how transaction extraction works inside a PDF statement, what fields to capture and how to validate the result before it reaches a ledger.",
    category: "Extraction",
    publishedAt: "2026-11-18",
    updatedAt: "2026-11-18",
    readingMinutes: 8,
    intro: [
      "Extracting transactions from a PDF is not the same as reading its text. A statement can contain the right words in the right order and still produce the wrong table if the rows are reconstructed incorrectly.",
      "This article explains the mechanics: what a PDF actually stores, how a parser turns words into rows, which fields matter, and how to validate extraction before the data reaches a ledger.",
    ],
    sections: [
      {
        heading: "Two kinds of PDF, two extraction paths",
        paragraphs: [
          "A digital statement stores characters and positions. Extraction can read them directly. A scanned statement stores images, so recognition has to happen first. Some PDFs have an OCR text layer added by the scanner, which behaves like a digital file but inherits OCR errors.",
          "The first step in any extractor is deciding which situation it is dealing with. Treating a scan as a digital file produces an empty result; treating a clean digital file as a scan wastes time and reduces accuracy.",
        ],
      },
      {
        heading: "A PDF is a page, not a table",
        paragraphs: [
          "Under the surface, a statement is a set of text runs placed at coordinates. There is no column object and no row object. The visual table is an emergent effect of alignment, lines and whitespace.",
          "To reconstruct a table, an extractor builds lines from words with similar vertical positions, finds the header and column anchors, and assigns each word to a field based on its horizontal position. Multi-page statements require repeating that process per page and stitching the rows together.",
        ],
      },
      {
        heading: "The fields worth extracting",
        table: {
          caption: "Transaction fields",
          headers: ["Field", "Why it matters"],
          rows: [
            ["Posting date", "The primary date for sorting and period filtering"],
            ["Value date", "Used by some reconciliation and settlement processes"],
            ["Description", "The audit trail and the main input for coding"],
            ["Reference", "Matches the row to an invoice, cheque or transfer"],
            ["Debit / Credit", "Direction, kept separate to avoid sign ambiguity"],
            ["Balance", "Validates the running total"],
            ["Currency", "Needed for multi-currency accounts"],
          ],
        },
      },
      {
        heading: "Why multi-line descriptions break naive parsing",
        paragraphs: [
          "A merchant description often wraps onto a second line. If the parser treats every line as a transaction, one payment becomes two rows and every later row shifts. If it drops continuation lines, the description loses the part that identifies the merchant.",
          "The correct behaviour is to detect that a line has no date and no amount, then attach it to the preceding transaction. The same rule prevents page headers from becoming rows.",
        ],
      },
      {
        heading: "Validation is part of extraction",
        bullets: [
          "Opening balance plus credits minus debits should equal the closing balance.",
          "Consecutive running balances should agree with the amounts between them.",
          "Every row should have a date, a description and at least one amount.",
          "Duplicate detection should compare date, description and amount, not just one field.",
          "Unresolved lines should be reported, not silently discarded.",
        ],
        paragraphs: [
          "These checks catch the failures that a visual skim misses: a decimal point read as a comma, a page missed entirely, or a transaction split across two rows.",
        ],
      },
      {
        heading: "Manual extraction versus a parser",
        paragraphs: [
          "Manual extraction is viable for one short, digital statement. Select the table, paste it, repair the columns and reconcile. It becomes expensive when statements are long, scanned or recurring.",
          "A parser automates the geometry and the field assignment, but it cannot remove the review step. The useful question is not \"is it automatic?\" but \"does it show me what it was unsure about?\". FlowParse's [PDF transaction extractor](/pdf-transaction-extractor) exposes the ledger, the reconciliation and the review reasons before export.",
        ],
      },
      {
        heading: "What to do with the extracted rows",
        paragraphs: [
          "Export to XLSX when a person will analyse or annotate the data, or to CSV when a system will import it. Keep the original PDF with the export so the source can be checked later. If you are converting statements for clients, read [Bank statement converter for accountants](/bank-statement-converter-for-accountants).",
        ],
      },
    ],
    faq: [
      {
        question: "Can I extract transactions from a scanned statement?",
        answer:
          "Yes, after OCR. The extractor needs recognised text with positions, which OCR provides. Expect more review flags than a digital statement.",
      },
      {
        question: "Why does a table have more rows than the statement?",
        answer:
          "A wrapped description or a repeated page header was treated as a new row. A parser that groups lines by date and amount avoids this.",
      },
      {
        question: "Should I extract the running balance?",
        answer:
          "Yes, when the statement prints one. It is the cheapest way to validate the extraction and to spot a missing or duplicated transaction.",
      },
      {
        question: "Does extraction change the original PDF?",
        answer:
          "No. The PDF is stored privately and the extracted rows are saved separately, so the source remains available for comparison.",
      },
    ],
    related: [
      "/pdf-transaction-extractor",
      "/convert-bank-statement-pdf-to-excel",
      "/resources/how-to-convert-bank-statement-pdf-to-excel",
      "/resources/convert-scanned-bank-statements-ocr",
    ],
  },
  {
    slug: "excel-vs-csv-bank-statement-conversion",
    title: "Excel vs CSV for Bank Statement Conversion",
    description:
      "When to export a bank statement as Excel and when to use CSV, including date formats, decimal handling, delimiters, accounting imports and spreadsheet safety.",
    category: "Formats",
    publishedAt: "2026-11-18",
    updatedAt: "2026-11-18",
    readingMinutes: 7,
    intro: [
      "Excel and CSV can hold the same transactions, but they are not interchangeable. One is a workbook format with types, formatting and multiple sheets; the other is plain text with a delimiter. Choosing the wrong one creates avoidable work at the next step.",
      "This guide compares the two for bank statement conversion and gives a simple rule for picking one.",
    ],
    sections: [
      {
        heading: "What each format actually is",
        paragraphs: [
          "XLSX is a zipped XML workbook. It stores cell types, number formats, formulas, styles, column widths and multiple sheets. Opening it in Excel gives you a formatted, typed table.",
          "CSV is a text file with rows separated by newlines and fields separated by a delimiter, usually a comma. It has no types, no formatting and no formulas. What you see is what another program will parse.",
        ],
      },
      {
        heading: "Comparison",
        table: {
          caption: "Excel versus CSV for statement data",
          headers: ["", "Excel (XLSX)", "CSV"],
          rows: [
            ["Human review", "Strong: formatting, filters, notes", "Basic: opens as a plain grid"],
            ["Multiple sheets", "Yes", "No"],
            ["Formulas and pivot tables", "Native", "Only after opening in a spreadsheet"],
            ["Accounting imports", "Sometimes", "Usually the expected format"],
            ["Date and number types", "Stored in the file", "Implicit, parsed by the receiving tool"],
            ["Delimiter problems", "None", "Commas and quotes need escaping"],
            ["Macros", "Possible in XLSM, not XLSX", "None"],
            ["File size", "Larger", "Smaller"],
          ],
        },
      },
      {
        heading: "Choose Excel when a person is the next reader",
        paragraphs: [
          "If you will review, annotate, format, chart or model the data, Excel is the better container. It keeps dates and numbers typed, lets you add a reconciliation tab, and does not depend on the receiving tool's CSV parser being configured correctly.",
          "For an accountant's working paper, a single workbook with a summary, reconciliation, transactions and notes is easier to file than four separate CSVs.",
        ],
      },
      {
        heading: "Choose CSV when software is the next reader",
        paragraphs: [
          "Accounting imports, databases, scripts and ETL tools usually expect CSV. A stable header row and normalised values matter more than presentation. CSV is also easier to diff between versions, which helps when you reprocess a statement.",
          "Check the importer's expectations before exporting: delimiter, encoding, date order and whether it wants one signed amount or separate debit and credit columns.",
        ],
      },
      {
        heading: "The traps that make a CSV fail",
        bullets: [
          "Locale: a comma decimal separator conflicts with a comma delimiter.",
          "Dates: 03/04/2026 is ambiguous without a stated order.",
          "Quoting: a description containing a comma or quote must be escaped.",
          "Encoding: a non-UTF-8 file can corrupt currency symbols and merchant names.",
          "Formula injection: text beginning with =, +, - or @ can execute when opened in a spreadsheet.",
        ],
        paragraphs: [
          "FlowParse exports UTF-8 CSV, quotes fields that need it, uses ISO dates, and neutralises formula-like text. The receiving tool still decides how to interpret the values.",
        ],
      },
      {
        heading: "A simple rule",
        paragraphs: [
          "Export both if you are unsure. Use Excel for the review and the working paper, and CSV for the import. FlowParse generates both from the same reviewed ledger, so you are not converting the statement twice. See [PDF to Excel](/convert-bank-statement-pdf-to-excel) and [PDF to CSV](/convert-bank-statement-pdf-to-csv).",
        ],
      },
    ],
    faq: [
      {
        question: "Can I convert CSV to Excel later?",
        answer:
          "Yes, but Excel will guess the types when it opens the file. Import through Data > From Text/CSV and set the date and amount columns explicitly if accuracy matters.",
      },
      {
        question: "Which format should I send a client?",
        answer:
          "Excel if they will read it, CSV if their software will import it. Ask which their system expects rather than guessing.",
      },
      {
        question: "Does CSV support multiple sheets?",
        answer:
          "No. Use one CSV per table or export Excel when you need a summary, reconciliation and transactions in one file.",
      },
      {
        question: "Is CSV more secure?",
        answer:
          "CSV cannot carry macros, which removes one attack path. It is still plain text with no encryption, so share it through a secure channel.",
      },
    ],
    related: [
      "/convert-bank-statement-pdf-to-csv",
      "/convert-bank-statement-pdf-to-excel",
      "/bank-statement-converter-for-accounting-software",
      "/resources/how-to-convert-bank-statement-pdf-to-excel",
    ],
  },
  {
    slug: "automate-bank-statement-processing-accountants",
    title: "How Accountants Can Automate Bank Statement Processing",
    description:
      "A realistic automation workflow for client bank statements: standardise intake, convert and reconcile, review by exception, import safely and keep an audit trail.",
    category: "Practice",
    publishedAt: "2026-11-18",
    updatedAt: "2026-11-18",
    readingMinutes: 10,
    intro: [
      "Statement automation usually fails for a boring reason: the input is inconsistent. One client sends a digital PDF, another sends a phone photo, a third sends six months in one file with pages out of order. No tool fixes that without a process around it.",
      "This article describes a workflow that automates the repetitive parts and keeps a human decision where it belongs: on exceptions, coding and the final reconciliation.",
    ],
    sections: [
      {
        heading: "Where automation fits",
        paragraphs: [
          "Automation is good at extracting fields, normalising dates and amounts, checking balances and producing consistent exports. It is not good at deciding whether a client's description means \"office supplies\" or \"client entertainment\", or whether an unusual transfer is legitimate.",
          "Design the workflow so the tool does the extraction and validation, and the accountant reviews only what the tool flags. That is the difference between automating work and automating blame.",
        ],
      },
      {
        heading: "Step 1: standardise intake",
        bullets: [
          "Ask for digital PDFs from online banking, not photographs.",
          "Name files with client, account and period so overlaps are visible.",
          "Collect statements in one place instead of across email threads.",
          "Tell clients to remove PDF passwords before sending, or agree a secure way to handle them.",
          "Record which statements are expected, so a missing month is caught before month-end.",
        ],
      },
      {
        heading: "Step 2: convert and reconcile",
        paragraphs: [
          "Convert each statement separately. Keep the reconciliation attached to the document. A batch that merges everything into one anonymous file makes it much harder to investigate a mismatch later.",
          "Check the opening and closing balances, the row count and the flagged rows. For scanned statements, read the OCR confidence before accepting the output.",
        ],
      },
      {
        heading: "Step 3: review by exception",
        paragraphs: [
          "A useful review queue is short. Flagged rows, failed reconciliations, duplicate suspicions and OCR pages are the rows that need attention. Rows that passed validation still deserve sampling, but they do not need line-by-line checking.",
          "This is also where the professional judgement happens. The tool can say a date is ambiguous; it cannot decide which date the client intended.",
        ],
      },
      {
        heading: "Step 4: import or post safely",
        bullets: [
          "Map the CSV columns once and reuse the mapping.",
          "Import one statement at a time and reconcile the imported total.",
          "Do not re-import a statement that is already in the ledger.",
          "Keep the original PDF, the export and the extraction report together.",
          "If the import fails partway, check what was accepted before retrying.",
        ],
      },
      {
        heading: "Step 5: retain the evidence",
        paragraphs: [
          "Automation does not remove the need for a source trail. Store the statement, the exported ledger and the review notes for the period your engagement requires. If a number is questioned later, the trail explains how it was produced.",
          "FlowParse keeps each statement and its extraction report in the account, and lets you re-export the reviewed data. It is not a document management system, so integrate it with your own retention policy.",
        ],
      },
      {
        heading: "What not to automate",
        bullets: [
          "Client identity and authorisation checks.",
          "Coding decisions that depend on the chart of accounts or a conversation with the client.",
          "Judgements about unusual transactions or going-concern indicators.",
          "Final sign-off on a reconciliation.",
          "Retention and deletion decisions that your policy requires a person to make.",
        ],
      },
      {
        heading: "A realistic outcome",
        paragraphs: [
          "A well-designed workflow removes most of the typing and the first-pass reconciliation. It does not remove review; it concentrates it. For the conversion step, start with [Bank statement converter for accountants](/bank-statement-converter-for-accountants) or [Convert bank statements to spreadsheets](/convert-bank-statements-to-spreadsheets).",
        ],
      },
    ],
    faq: [
      {
        question: "How much of statement processing can be automated?",
        answer:
          "Extraction, normalisation, balance checks and export can be automated for clean digital statements. Scanned statements need more review. Coding and final sign-off remain human decisions.",
      },
      {
        question: "Can automation handle multiple clients?",
        answer:
          "The conversion can, within the plan's page allowance and batch limit. Client confidentiality still requires separate accounts, permissions and retention rules in your practice.",
      },
      {
        question: "What is the biggest cause of failed automation?",
        answer:
          "Inconsistent input: scans instead of digital PDFs, passwords, missing pages and mixed periods. Standardise intake first.",
      },
      {
        question: "Do I still need to reconcile if the tool does?",
        answer:
          "Yes. Treat the tool's reconciliation as a first pass and evidence, not as a substitute for your own review and sign-off.",
      },
    ],
    related: [
      "/bank-statement-converter-for-accountants",
      "/bank-statement-converter-for-bookkeepers",
      "/convert-bank-statements-to-spreadsheets",
      "/resources/how-to-convert-bank-statement-pdf-to-excel",
    ],
  },
];
