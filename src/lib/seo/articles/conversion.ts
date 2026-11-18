import type { ArticleContent } from "@/lib/seo/content-types";

export const conversionArticles: ArticleContent[] = [
  {
    slug: "how-to-convert-bank-statement-pdf-to-excel",
    title: "How to Convert a Bank Statement PDF to Excel",
    description:
      "A practical guide to turning a bank statement PDF into a usable Excel ledger: keeping dates and amounts intact, reconciling balances and avoiding errors.",
    category: "Conversion",
    publishedAt: "2026-11-18",
    updatedAt: "2026-11-18",
    readingMinutes: 8,
    intro: [
      "Converting a bank statement to Excel sounds like a small copy-and-paste job until you try it. The PDF pastes as blocks of text, dates and amounts lose their types, descriptions wrap, and page headers appear in the middle of the table.",
      "This guide covers the practical route from a statement PDF to a spreadsheet you can actually sum, filter and import. It applies whether you convert one personal statement or a month of client statements.",
    ],
    sections: [
      {
        heading: "What converting a statement actually means",
        paragraphs: [
          "A bank statement is a presentation document. Its layout is optimised for print, and the same information can be arranged differently from one bank to the next. A spreadsheet is a data document: one row per transaction, one field per column, and values stored as dates and numbers rather than text.",
          "Conversion therefore has three parts: extracting the transaction fields, normalising them into a consistent schema, and validating the result against the statement's own balances. Skipping the third part is what produces a file that looks right and reconciles wrong.",
        ],
      },
      {
        heading: "Step 1: start with the best PDF you have",
        bullets: [
          "Download the statement from online banking rather than scanning a printout. A digital PDF keeps its text layer.",
          "Remove password protection before conversion. Encrypted PDFs cannot be parsed reliably.",
          "Keep the whole statement, including pages that only contain a summary. The opening and closing balances are often there.",
          "Check that the PDF is the correct account and period before you spend time on it.",
        ],
        paragraphs: [
          "If the only copy is a scan, the workflow still works, but it relies on OCR. Read [How to convert scanned bank statements using OCR](/resources/convert-scanned-bank-statements-ocr) before you start.",
        ],
      },
      {
        heading: "Step 2: choose manual or automated conversion",
        paragraphs: [
          "Manual conversion means selecting the table in the PDF viewer and pasting it into Excel, then repairing the result. It can work for a single, simple, digital statement with a clean table. It fails on scanned pages, multi-line descriptions and statements where the columns are not separated by consistent whitespace.",
          "Automated conversion reads the PDF's text positions, rebuilds rows and assigns fields. The trade-off is that you need a review step, because no parser is right about every layout. FlowParse keeps that review visible: the ledger, the reconciliation and the flagged rows are all shown before you export.",
        ],
      },
      {
        heading: "Step 3: check the table structure",
        paragraphs: [
          "Before you trust any conversion, look at the columns. A useful bank statement sheet has separate fields for the posting date, value date, description, reference, debit, credit and balance. Mixing debits and credits into one signed column is workable but easier to misread.",
        ],
        table: {
          caption: "A safe column layout",
          headers: ["Column", "Why it matters"],
          rows: [
            ["Date", "Sorting and period filtering depend on a real date value"],
            ["Value date", "Some reconciliation processes use the value date, not the posting date"],
            ["Description", "The main audit trail for what the transaction was"],
            ["Reference", "Matches the transaction to an invoice or payment"],
            ["Debit / Credit", "Keeps direction explicit and avoids sign confusion"],
            ["Balance", "Lets you verify the running balance"],
          ],
        },
      },
      {
        heading: "Step 4: reconcile before you format",
        paragraphs: [
          "Add up the opening balance and the credits, subtract the debits, and compare the result with the closing balance. If the two do not match, stop and find out why. Formatting a file that does not reconcile only makes the error harder to see.",
          "Common causes of a mismatch include a missed page, a transaction that was split across two rows, a decimal point read as a comma, and a duplicate row at a page boundary.",
        ],
      },
      {
        heading: "Step 5: format dates and amounts safely",
        bullets: [
          "Use ISO dates (YYYY-MM-DD) if the file will be imported into another system.",
          "Keep amounts as numbers with a dot decimal separator, not text with currency symbols.",
          "Do not merge cells in the transaction table; it breaks sorting and filtering.",
          "Keep one header row at the top and no repeated headers in the middle.",
          "Keep the original PDF with the workbook so the source can be checked later.",
        ],
      },
      {
        heading: "Common problems and fixes",
        table: {
          caption: "Symptoms and causes",
          headers: ["Symptom", "Likely cause", "Fix"],
          rows: [
            ["Amounts are text, not numbers", "Pasted with currency symbols or spaces", "Strip symbols and use a numeric column"],
            ["Dates sort incorrectly", "Stored as text or in mixed orders", "Normalise to one date format"],
            ["Extra rows between transactions", "A description wrapped onto a second line", "Merge the wrapped text into its parent row"],
            ["Missing transactions at a page break", "The table continued across pages", "Check the first and last rows of every page"],
            ["A total does not match", "Duplicate or dropped row", "Reconcile and compare row counts"],
          ],
        },
      },
      {
        heading: "A faster path",
        paragraphs: [
          "If the statement is digital and the table is clean, manual conversion is a reasonable one-off. If you convert statements regularly, the review-and-export workflow is faster and produces a consistent schema. Start with [Convert a bank statement PDF to Excel](/convert-bank-statement-pdf-to-excel), or use the [PDF transaction extractor](/pdf-transaction-extractor) if you need the raw ledger rather than a formatted workbook.",
        ],
      },
    ],
    faq: [
      {
        question: "Can Excel open a bank statement PDF directly?",
        answer:
          "Excel can import some PDFs through Power Query, but the result depends on the PDF's structure. A statement table often arrives with merged text, repeated headers and text-formatted amounts, so it still needs cleaning.",
      },
      {
        question: "Why do my copied amounts show as text?",
        answer:
          "The clipboard includes currency symbols, thousands separators or non-breaking spaces. Excel treats the result as text. Convert the column to numbers after removing those characters.",
      },
      {
        question: "How do I know the conversion is complete?",
        answer:
          "Reconcile the opening balance plus credits minus debits against the closing balance, and compare the row count with the statement. A mismatch means something was dropped or duplicated.",
      },
      {
        question: "Should I keep the original PDF?",
        answer:
          "Yes. Keep it with the spreadsheet as the source document, especially for client work or audit preparation.",
      },
    ],
    related: [
      "/convert-bank-statement-pdf-to-excel",
      "/convert-bank-statement-pdf-to-csv",
      "/resources/extract-transactions-from-pdf-bank-statement",
      "/bank-statement-converter-for-accountants",
    ],
  },
  {
    slug: "convert-scanned-bank-statements-ocr",
    title: "How to Convert Scanned Bank Statements Using OCR",
    description:
      "How OCR turns scanned bank statements into usable transaction data, what affects accuracy, and how to review low-confidence rows before exporting to Excel or CSV.",
    category: "OCR",
    publishedAt: "2026-11-18",
    updatedAt: "2026-11-18",
    readingMinutes: 9,
    intro: [
      "A scanned statement is a picture. The PDF contains no text layer, so selecting it returns nothing and a normal parser sees a blank page. OCR is the step that turns those pixels into characters the parser can work with.",
      "This guide explains where OCR fits, how to prepare a scan, and why a responsible conversion reports confidence instead of pretending every recognised digit is correct.",
    ],
    sections: [
      {
        heading: "When a statement needs OCR",
        paragraphs: [
          "There are two kinds of PDF. A digital statement exported by a bank contains text and font information; selecting a word highlights it. A scanned statement contains an image per page, sometimes with an invisible OCR layer added by the scanner.",
          "The first kind can be parsed directly. The second needs recognition before parsing. Mixed documents exist too: a digital statement with a scanned appendix, or a bundle where some pages were printed and re-scanned.",
        ],
      },
      {
        heading: "How OCR works on a bank statement",
        bullets: [
          "The page is rendered to an image at a chosen resolution, typically 300 DPI.",
          "The OCR engine detects text regions and lines, then recognises characters.",
          "Each word is returned with a bounding box and a confidence score.",
          "The parser groups words into rows, finds the table columns and assigns fields.",
          "The reconciliation checks the result against the statement's balances.",
        ],
        paragraphs: [
          "Recognition is only the first half. A page of OCR text without row reconstruction is still not a spreadsheet, and a table read in the wrong column order produces plausible-looking values in the wrong fields.",
        ],
      },
      {
        heading: "What affects OCR quality",
        table: {
          caption: "Scan factors and their effect",
          headers: ["Factor", "Effect"],
          rows: [
            ["Resolution", "Low DPI loses thin strokes; 300 DPI is a sensible target"],
            ["Skew", "Tilted text makes columns drift and rows merge"],
            ["Contrast", "Faded print reduces character confidence"],
            ["Compression", "Heavy JPEG artefacts blur digits and decimal points"],
            ["Page geometry", "Multi-column layouts can be read in the wrong order"],
            ["Language", "OCR data must include the statement's language"],
          ],
        },
      },
      {
        heading: "Preparing a better scan",
        bullets: [
          "Scan at 300 DPI or higher in greyscale or colour.",
          "Keep the page straight; most scanner software has a deskew option.",
          "Include the whole page, including headers and totals.",
          "Avoid photographing a screen; moiré patterns confuse recognition.",
          "If the bank offers a digital PDF, use it instead of a scan.",
        ],
      },
      {
        heading: "Confidence and review",
        paragraphs: [
          "An OCR engine returns a confidence score per word. A mean page confidence below 65% is a strong signal that the page needs a human look. FlowParse marks those pages, flags every row they produced and forces the statement's confidence to low.",
          "Any statement that relies on OCR is capped at medium confidence overall. That is not a bug; it is a statement about the source. A clean-looking scan can still misread one digit, and a single wrong digit can break a reconciliation.",
        ],
      },
      {
        heading: "What OCR cannot fix",
        bullets: [
          "Handwritten annotations and signatures.",
          "Torn, creased or partially obscured pages.",
          "A missing page: the transactions on it cannot be recovered.",
          "Statements in a language for which no OCR data is installed.",
          "A scan so compressed that decimal points disappear.",
        ],
        paragraphs: [
          "When the result is unreliable, the correct outcome is a clear failure or a review flag, not an invented transaction. FlowParse lists unresolved source lines so they can be entered manually.",
        ],
      },
      {
        heading: "From scan to workbook",
        paragraphs: [
          "Once the rows are extracted, the export is the same as for a digital statement: XLSX for analysis or CSV for an import. The difference is the review note and confidence attached to the OCR pages. Start with [Convert a scanned bank statement to Excel](/convert-scanned-bank-statement-to-excel) or read more about [bank statement OCR](/bank-statement-ocr).",
        ],
      },
    ],
    faq: [
      {
        question: "Is OCR accurate enough for bookkeeping?",
        answer:
          "It can be, with review. Digital statements are more reliable. For scanned pages, check the confidence flags and reconcile the totals before posting anything.",
      },
      {
        question: "Can I OCR a photo of a statement?",
        answer:
          "You can convert the photo to a PDF and upload it, but a flat scan produces better results. FlowParse accepts PDFs, not image files directly.",
      },
      {
        question: "Does OCR run locally or in the cloud?",
        answer:
          "In FlowParse's processor service using a local Tesseract installation. Pages are not sent to an external OCR API.",
      },
      {
        question: "Why are all rows on a page flagged?",
        answer:
          "The page's mean OCR confidence was below the threshold. That flags every row from the page so the reviewer knows the whole page is uncertain, not just one line.",
      },
    ],
    related: [
      "/convert-scanned-bank-statement-to-excel",
      "/bank-statement-ocr",
      "/convert-bank-statement-pdf-to-excel",
      "/resources/how-to-convert-bank-statement-pdf-to-excel",
    ],
  },
];
