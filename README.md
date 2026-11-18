# FlowParse

**Turn bank statements into structured financial data.**

FlowParse is a commercial-ready SaaS MVP that converts PDF bank statements into editable, reconciled Excel and CSV data. It is built with Next.js, Supabase, and a Python extraction service, and is designed around three rules:

1. **Never invent transactions.** Rows come only from text that exists in the document.
2. **Never silently discard data.** Ambiguous rows are flagged, unresolved lines are reported, and failed statements remain available for manual entry.
3. **Never expose another user's data.** Every database row, file, and export is isolated by authenticated ownership.

---

## What is included

| Area | Capability |
| --- | --- |
| Landing page | Product positioning, upload demonstration, how it works, features, supported formats, security, pricing, FAQ, and footer |
| SEO and content | Nine solution landing pages, tested bank guides, a resources section with articles, XML sitemap, robots policy, canonical URLs, Open Graph images and JSON-LD |
| Authentication | Email/password sign-up, sign-in, sign-out, forgot password, and password reset |
| Dashboard | Statement totals, transaction totals, rows needing review, failed conversions, monthly allowance, and recent conversions |
| Conversion workspace | Multi-file drag and drop, PDF validation, real stage/percentage progress, editable ledger, reconciliation, extraction report, per-file retry, delete, and exports |
| History | All statements with dates, transaction counts, statuses, and direct Excel/CSV downloads |
| Settings | Profile editing, subscription status, hosted billing portal, real monthly/total usage, plan limits, and security details |
| Billing | Four monthly plans with hosted Dodo Payments checkout, signed and idempotent webhooks, automatic entitlement sync, and a customer portal for invoices, payment methods, and cancellation |
| Exports | Formula-safe CSV and formatted XLSX with statement summary, reconciliation details, transactions, value dates, per-row currencies, and review notes |
| Extraction engine | Digital text extraction, scanned-page detection with OCR fallback, layout/table-aware row parsing, and reconciliation |
| Transaction fields | Transaction date, value date, description, reference, debit, credit, running balance, and currency |
| Validation | Opening/closing balance reconciliation, running-balance checks, row completeness, currency/date ambiguity, OCR confidence, and duplicate detection |
| Review workflow | Every ambiguous or duplicate row is kept, flagged, and shown in the editor and extraction report |
| Bank support | Generic layout engine plus conservative declarative profiles for UK, US, and Australian banks |

Supported statement statuses are **Uploaded**, **Queued**, **Processing**, **Extracted** (`completed`), **Needs review** (`partial`), and **Failed**. The UI and exports use the same status vocabulary.

While a statement is queued or processing, the processor writes the current pipeline stage and a real completion percentage to the database. The percentage advances only when the processor reaches the corresponding step, so the workspace, statement history, and dashboard show actual work rather than a timer. Each attempt is recorded in `conversion_jobs`; the document keeps a denormalised status and progress copy so the existing dashboard and history views stay cheap to render. Terminal states are finalised by a database trigger: **Extracted** and **Needs review** end at 100%, and failed extractions record **Extraction failed** with a 100% terminal mark. Active status pages refresh every three seconds until processing finishes.

Failed conversions can be retried from the upload batch or the statement page. A retry is allowed only when the statement has no saved rows; completed or partially extracted statements are locked so a re-run cannot overwrite reviewed data. Extraction writes replace the statement's rows atomically, so retrying a failed document never appends duplicate transactions.

---

## Architecture

```text
Browser
  │
  │  1. POST /api/statements (authenticated)
  │  2. PUT signed upload URL
  ▼
Next.js server ──────────────► Supabase Storage (private bucket)
  │                                   ▲
  │  3. POST /v1/jobs                 │ service role
  ▼                                   │
Python FastAPI processor ─────────────┘
  │
  │  4. claim, download, extract, save
  ▼
Supabase Postgres (RLS) ◄──── Supabase Auth
```

### Conversion flow

1. The browser validates the PDF header and file size, then asks the Next.js API to create the statement.
2. `POST /api/statements` verifies authentication, loads the user's profile and subscription plan, checks the monthly allowance from `usage_records`, calls the `create_statement` RPC to insert an ownership-scoped `uploaded_documents` row (the RPC derives the storage path from the authenticated owner and document id), and returns a signed upload URL for `{user_id}/{document_id}/original.pdf`.
3. The browser uploads the PDF directly to the private `statements` bucket. The service-role key never reaches the browser.
4. `POST /api/statements/:id/process` verifies ownership, calls the `queue_conversion` RPC to create the next `conversion_jobs` attempt, and queues work with the Python processor using a shared `X-Processor-Key`.
5. The processor re-checks the job and document owner, atomically claims the queued job, downloads the PDF, and extracts rows. As each pipeline step starts, it persists a PII-free stage label and monotonic percentage; progress reporting failures never fail a readable extraction.
6. The extraction engine reads the text layer. If a page does not contain enough usable text, it renders that page and falls back to Tesseract OCR.
7. The parser builds geometric lines and words, detects header columns and table anchors, then extracts dates, value dates, references, descriptions, debit/credit/balance amounts, and row currencies. It uses running balances and sign/marker evidence to separate debits from credits, and falls back to headerless-layout inference when no header is present.
8. Bank metadata, statement period, opening/closing balances, date order, and currency are normalised. Ambiguous dates, currencies, amounts, OCR pages, and duplicate rows are flagged and retained. Unresolved source lines are reported instead of guessed.
9. Validation checks opening balance + credits − debits against the stated closing balance, verifies running balances, row completeness, and duplicates, and records an extraction confidence level.
10. Results are saved through the service-role-only `save_extraction_result` RPC. It revalidates the job/document pair, replaces the document's `extracted_transactions` atomically, updates the job and document to `completed`, `partial`, or `failed`, and the usage triggers update the monthly counters.
11. The workspace polls the authenticated API until processing finishes, shows the live stage and percentage, then shows the editable ledger, reconciliation panel, and extraction report. Failed batch items keep an inline retry action, and active list pages refresh themselves.
12. Excel and CSV exports are generated on the server after an ownership check. PDF access is also authenticated and ownership-scoped.

The processor is an independent internal service. Next.js only submits jobs; it does not download or parse PDFs itself. This keeps OCR memory and CPU usage off the web tier. On Vercel, the app reaches the processor through the `PROCESSOR_URL` service binding declared in `vercel.json`, and a `processor-worker` daemon claims queued jobs and runs extraction continuously.

### Billing flow

```text
Settings plan card
  │  1. POST /api/billing/checkout  { plan: "pro" }
  ▼
Next.js server ── maps the plan slug to a Dodo product id (server-side only)
  │  2. creates/links a Dodo customer, creates a checkout session
  ▼
Dodo hosted checkout (card data never touches FlowParse)
  │  3. browser returns to /checkout/success?plan=pro
  ▼
Confirmation page ── polls the signed-in account; never grants access itself
  ▲
  │  4. Dodo → POST /api/webhooks/dodo (raw body + webhook signature)
  │  5. Next.js verifies the signature, re-reads the subscription from Dodo,
  │     resolves the plan, and calls the idempotent apply_billing_event RPC
  └── profiles.plan_id + billing_subscriptions updated
```

The return URL is only a user-experience signal. A plan changes only after a
signature-verified webhook is reconciled against the authoritative Dodo
subscription record, so a forged redirect cannot unlock a paid plan.


### Extraction engine

The engine is split into focused modules under `services/processor/app/extract/`:

| Module | Responsibility |
| --- | --- |
| `pdf_text.py` | Opens the PDF, extracts words, detects pages that need OCR, builds geometric lines, and enforces file/page limits |
| `ocr.py` | Tesseract configuration, page rendering, word-level OCR, and mean-confidence scoring |
| `amounts.py` | Money token parsing, debit/credit markers, ISO codes and symbols, international grouping, currency detection |
| `dates.py` | Date token parsing, date-order inference, statement-period detection, value dates |
| `normalisation.py` | Description whitespace normalisation and per-row currency resolution |
| `validation.py` | Balance reconciliation, running-balance checks, duplicate detection, OCR-confidence assessment |
| `parser.py` | Layout/table orchestration, header and column detection, row reconstruction, review flags, stage progress |
| `banks/` | Declarative bank profiles, detection registry, and the generic fallback |
| `progress.py` | Progress callback type and failure-isolated notifier used by the pipeline |
| `pipeline.py` | Public `extract_pdf()` entry point used by the API job runner |

Supported input and layout characteristics:

- digital PDF text layers, scanned pages, and mixed documents;
- password-protected and corrupt files produce clear failures;
- header-driven tables and headerless layouts;
- single-amount, debit/credit, amount/balance, and debit/credit/balance tables;
- UK/US/AU and European date formats, dashed and named months, and yearless dates aligned to the statement period;
- `1,234.56`, `1.234,56`, `1234,56`, Indian grouping, parentheses, trailing/leading minus, `DR`/`CR`, currency symbols, and ISO codes;
- separate value-date and reference columns when the header identifies them, plus inline `Value date:` labels and a second leading date;
- running balances used to infer debit/credit direction when the layout does not label it.

Extraction never drops a row that contains money movement. Ambiguous rows are
returned with `needs_review` and human-readable `review_reasons`. Potential
duplicates are detected within the statement using date, normalised description,
and amount; rows with two explicit different references are treated as distinct.
Duplicate rows are kept and flagged, and the duplicate check appears in
validation and in the extraction report. A row whose explicit currency differs
from the statement currency is flagged, and the statement is not marked
`verified` because the summary totals would mix currencies.

OCR pages are scored per page. A mean confidence below `65%` marks the page as
low confidence, flags every row from that page, and forces the extraction
confidence to `low`. Any OCR page caps confidence at `medium`, so an OCR result
is never presented as a clean digital read. `partial` status is used whenever
confidence is not `high`, any row needs review, or any source line was
unparsed.

To add a bank, follow [`docs/adding-a-bank.md`](docs/adding-a-bank.md). Profiles
provide conservative defaults only; explicit document evidence always wins.

---

## Stack

- **Web:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4
- **UI:** shadcn-style components, Radix primitives, Lucide icons, Sonner toasts
- **Auth and data:** Supabase Auth, Postgres, Row Level Security, private Storage
- **Billing:** Dodo Payments (Merchant of Record) with hosted checkout, customer portal, and signed webhooks
- **Processing:** Python 3.12, FastAPI, PyMuPDF, pytesseract, Tesseract OCR
- **Exports:** ExcelJS
- **Validation:** Zod

---

## Project structure

```text
src/
  app/
    page.tsx                     Marketing landing page
    (marketing)/                 Solution pages, bank guides and resources
    sitemap.ts                   Generated XML sitemap
    robots.ts                    Crawl policy
    opengraph-image.tsx          Generated social share card
    (auth)/                      Login, sign-up, forgot password, reset password
    auth/confirm/route.ts        Email confirmation and recovery link exchange
    (app)/
      dashboard/                 Overview and recent conversions
      statements/                History and statement workspace
      settings/                  Profile, subscription, plans, and usage
      checkout/success/          Webhook-confirmed checkout result page
    api/billing/                 Checkout session and customer portal routes
    api/statements/              Upload, access, edits, processing, PDF, exports
    api/webhooks/dodo/           Signature-verified Dodo subscription webhook
  components/
    app/                         App shell, upload panel, user menu, billing actions
    auth/                        Auth forms and shell
    brand/                       Logo lockup, app tile, and glyph components
    marketing/                   Landing upload demo and mobile navigation
    seo/                         Marketing shell, templates, breadcrumbs, JSON-LD
    statements/                  Ledger editor, reconciliation, report, detail shell
    ui/                          Shared UI primitives
  lib/
    supabase/                    Browser, server, middleware, and admin clients
    account.ts                   Profile, subscription plan, and usage loader
    billing.ts                   Entitlement rules and status labels (pure)
    billing-sync.ts              Authoritative Dodo re-read and idempotent apply
    dodo.ts                      Server-only Dodo client and product mapping
    plans.ts                     Plan catalogue helpers and allowance formatting
    seo/                         Site metadata, solution/bank/article content
    validation.ts                Zod request schemas
    export.ts                    CSV and XLSX generation
public/
  brand/                         Logo lockups, glyphs, and app icon assets
supabase/
  config.toml                    Local Supabase ports and auth settings
  migrations/                    Schema, RLS, storage, triggers, and RPCs
services/processor/
  app/main.py                    FastAPI health and job endpoints
  app/jobs.py                    Job validation, manager, and extraction execution
  app/worker.py                  Queue-polling worker used by the Vercel daemon
  app/supabase_rest.py           Service-role REST client and stale-job recovery
  app/extract/
    pipeline.py                  Public extract_pdf() entry point
    pdf_text.py                  PDF text layer, page detection, line building
    ocr.py                       Tesseract rendering and OCR confidence
    amounts.py                   Money and currency parsing
    dates.py                     Date parsing and date-order inference
    normalisation.py             Description and row-currency normalisation
    validation.py                Reconciliation, duplicates, OCR confidence
    parser.py                    Layout-aware extraction orchestration
    banks/                       Bank profiles, detection, generic fallback
  tests/
    fixtures/generate.py         Synthetic PDF generators
    fixtures/financial_cases.py  Overdraft, grouping, multi-page and missing-data fixtures
    test_parser.py               End-to-end layout and error tests
    test_financial_cases.py      Financial edge cases and reconciliation accuracy
    test_amounts.py              Amount/currency unit tests
    test_dates.py                Date parsing unit tests
    test_validation.py           Reconciliation and duplicate tests
    test_worker.py               Worker polling and processing-mode tests
    test_main.py                 API queued/embedded dispatch tests
    test_supabase_rest.py        Queue claiming, races and storage-path ownership
    test_database_security.py    RLS, RPC ownership and usage-limit integration tests
tests/
  export.test.ts                 CSV and XLSX export tests
  finance.test.ts                Validation, reconciliation, plans and billing tests
docs/
  adding-a-bank.md               Step-by-step bank profile guide
```

---

## Brand

The supplied FlowParse artwork is served from `public/brand/` and rendered through
`src/components/brand/logo.tsx`:

- `flowparse-logo.svg` — default teal lockup for white surfaces.
- `flowparse-logo-reversed.svg` — white lockup for the teal CTA panel.
- `flowparse-app-icon.svg` — rounded teal tile with the white glyph; also the source
  for `src/app/icon.svg`, `src/app/apple-icon.png`, and `src/app/favicon.ico`.
- `flowparse-icon.svg` / `flowparse-icon-reversed.svg` — transparent glyphs used for
  watermarks and large brand moments.

Brand tokens: primary teal `#0E7A66`, ink `#101C18`, pale accent `#EAF6F1`, and deep
teal `#085C4D`. Headings use Poppins; body text uses Geist. Small labels use sentence
case with relaxed letter spacing to match the lowercase wordmark.

---

## Local development

### Prerequisites

- **Node.js 22+** and npm
- **Docker Desktop** for local Supabase
- **Supabase CLI** (`npx supabase` works without a global install)
- **Python 3.11/3.12**
- **Tesseract OCR 5** (optional if OCR is disabled)

Install Tesseract on Windows with the UB Mannheim build, then note the executable path (typically `C:\Program Files\Tesseract-OCR\tesseract.exe`). On macOS, `brew install tesseract`; on Debian/Ubuntu, `apt-get install tesseract-ocr tesseract-ocr-eng`.

### 1. Install JavaScript dependencies

```bash
npm install
```

### 2. Start Supabase and apply migrations

The local project uses custom ports to avoid collisions:

| Service | URL / port |
| --- | --- |
| API | `http://127.0.0.1:56321` |
| Postgres | `127.0.0.1:56322` |
| Studio | `http://127.0.0.1:56323` |
| Mailpit (email inbox) | `http://127.0.0.1:56324` |

```bash
npx supabase start
npx supabase db reset
npx supabase status -o env
```

`db reset` applies all migrations and recreates the private `statements` bucket. `supabase status -o env` prints the local anon and service-role keys. If you change the ports in `supabase/config.toml`, update the env files to match.

Create `.env.local` in the repository root:

```bash
# Supabase project
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>
# Server-side only (billing, webhook user mapping)
SUPABASE_SERVICE_ROLE_KEY=<local service-role key>

# Python processing service (server-side only)
PROCESSOR_URL=http://127.0.0.1:8000
PROCESSOR_API_KEY=<long random shared secret>

# Optional; defaults to the request origin
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000

# Dodo Payments (test mode by default)
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PAYMENTS_API_KEY=<Dodo test API key>
DODO_PAYMENTS_WEBHOOK_KEY=<Dodo webhook signing secret>
DODO_PRODUCT_FREE_TEST=<pdt_...>
DODO_PRODUCT_STARTER_TEST=<pdt_...>
DODO_PRODUCT_PRO_TEST=<pdt_...>
DODO_PRODUCT_BUSINESS_TEST=<pdt_...>
```

The anon key is safe to expose to the browser by design. The service-role key, processor key, Dodo API key, and webhook secret are not.

Billing is optional for local development; without the Dodo variables the app still works and shows the Free plan. To exercise checkout locally, create test-mode products in Dodo Payments, copy the four `pdt_...` ids into `.env.local`, and forward webhooks to the dev server:

```bash
npx --yes dodopayments-cli@latest wh listen http://localhost:3000/api/webhooks/dodo
```

The relay prints the webhook signing secret; put it in `DODO_PAYMENTS_WEBHOOK_KEY`. Checkout, renewal, cancellation, and failed-payment flows are all testable with Dodo's [test cards](https://docs.dodopayments.com/miscellaneous/testing-process). Never put live credentials in a local `.env.local`.


### 3. Set up the Python processor

```bash
cd services/processor
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

macOS/Linux:

```bash
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Edit `services/processor/.env`:

```bash
SUPABASE_URL=http://127.0.0.1:56321
SUPABASE_SERVICE_ROLE_KEY=<local service-role key>
SUPABASE_STATEMENTS_BUCKET=statements
PROCESSOR_API_KEY=<same shared secret as .env.local>
OCR_ENABLED=true
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe  # omit if tesseract is on PATH
```

Run the processor:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/health`. A healthy response includes `"ok": true`, `"configured": true`, and, when OCR is enabled, `"ocr_available": true`.

### 4. Run the web app

In a second terminal, from the repository root:

```bash
npm run dev
```

Open `http://127.0.0.1:3000`, create an account, and upload a statement. Local email confirmations are disabled in `supabase/config.toml`, so sign-up signs you in immediately. Password-reset emails are captured by Mailpit at `http://127.0.0.1:56324`, not sent externally.

### Useful commands

```bash
# TypeScript
npx tsc --noEmit
npm run lint
npm run dev
npm run build
npm start

# Python tests
cd services/processor
python -m pytest -q

# Inspect extraction for a local PDF without the UI
python -m app.cli path/to/statement.pdf
```

---

## Environment variables

### Next.js (`.env.local` or deployment environment)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key; protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for billing | Server-only client used for customer linking and the webhook RPC; bypasses RLS, so never expose it |
| `PROCESSOR_URL` | Yes for extraction | Base URL of the Python service. On Vercel this is injected by the `app` -> `processor` service binding; set it manually only for local development |
| `PROCESSOR_API_KEY` | Yes for extraction | Shared secret sent as `X-Processor-Key` |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical URL used in auth email redirects, checkout return URLs and SEO. Set it to `https://www.flowparse.app` for Production; Next inlines `NEXT_PUBLIC_*` at build time, so change it before redeploying. The code fallback is `https://www.flowparse.app`. |
| `DODO_PAYMENTS_ENVIRONMENT` | No | `test_mode` (default) or `live_mode`; any other value falls back to test mode |
| `DODO_PAYMENTS_API_KEY` | Yes for billing | Server-side Dodo API key for the selected environment |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Yes for billing | Signing secret used to verify the `webhook-signature` header |
| `DODO_PRODUCT_FREE_TEST` / `_LIVE` | No | Optional Free product id; the Free plan is not sold through checkout |
| `DODO_PRODUCT_STARTER_TEST` / `_LIVE` | Yes for billing | Dodo product id for the $9/month Starter plan |
| `DODO_PRODUCT_PRO_TEST` / `_LIVE` | Yes for billing | Dodo product id for the $19/month Pro plan |
| `DODO_PRODUCT_BUSINESS_TEST` / `_LIVE` | Yes for billing | Dodo product id for the $39/month Business plan |

Product ids are read from the `_TEST` or `_LIVE` suffix that matches `DODO_PAYMENTS_ENVIRONMENT`. A missing or malformed id disables checkout for that plan rather than guessing; live mode is never selected implicitly.

If billing is not configured, the app still runs: plan cards show an unavailable state, uploads are limited to the Free plan, and no entitlement can change.

If the processor variables are missing, uploads still succeed but processing is unavailable and shows a clear error. Manual transaction entry remains available.

### Processor (`services/processor/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | `http://127.0.0.1:56321` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | empty | Server-side database and storage access |
| `SUPABASE_STATEMENTS_BUCKET` | `statements` | Private PDF bucket |
| `PROCESSOR_API_KEY` | empty | Shared secret with the web app |
| `PORT` | `8000` | Container listener; set this in the Vercel project environment |
| `PROCESSOR_WORKERS` | `2` | Concurrent extraction threads in embedded mode |
| `PROCESSING_MODE` | `queued` in production; `embedded` otherwise | `embedded` runs jobs in the FastAPI process; `queued` leaves them for `processor-worker` |
| `WORKER_POLL_SECONDS` | `2` | Delay between empty queue polls in the worker |
| `MAX_PAGES` | `100` | Page cap per PDF |
| `MAX_FILE_MB` | `25` | Processing file-size cap |
| `OCR_ENABLED` | `true` | Enable scanned-page OCR |
| `TESSERACT_CMD` | empty | Explicit Tesseract path; empty means PATH or platform default |
| `OCR_DPI` | `300` | OCR render resolution |
| `TESSERACT_LANG` | `eng` | OCR language |
| `STALE_JOB_MINUTES` | `20` | Age after which processing jobs are marked failed at startup |

**Never prefix the service-role key with `NEXT_PUBLIC_`.** It must only exist in the processor runtime.

---

## Database schema

The backend is defined by the SQL migrations in `supabase/migrations/`. The original MVP tables are renamed in place, so existing documents, transactions, and relationships keep their ids and data.

| Table | Purpose | Ownership |
| --- | --- | --- |
| `profiles` | One row per auth user, created by an `auth.users` trigger; stores display name, company, email, and `plan_id` (the entitlement) | `id = auth.users.id` |
| `subscription_plans` | Plan catalogue and limits (`free`, `starter`, `pro`, `business`) with page allowances and batch limits | Public read-only |
| `billing_subscriptions` | Server-maintained mirror of the Dodo customer and subscription, current status, cancellation flag, and period end | Owner read-only; service role writes |
| `billing_webhook_events` | One row per processed `webhook-id`, used to make webhook handling idempotent | Service role only |
| `uploaded_documents` | Private source PDF metadata plus the denormalised current status/progress used by the UI | `user_id` |
| `conversion_jobs` | One extraction attempt per document, with attempt number, status, stage, progress, timestamps, and error | `user_id` + `document_id` |
| `extracted_transactions` | Structured ledger rows linked to the document and the job that produced them | `user_id` + `document_id` |
| `usage_records` | Monthly counters per user: pages processed, documents uploaded, conversions completed/failed, and storage bytes | `user_id` + `period_start` |

`conversion_jobs.attempt` is unique per document. A failed document can be retried; each retry creates a new attempt and `save_extraction_result` replaces that document's rows atomically. Completed and partially extracted documents are locked so a re-run cannot overwrite reviewed data.

## Data and security model

- RLS is enabled on `profiles`, `conversion_jobs`, `uploaded_documents`, `extracted_transactions`, and `usage_records`. The plan catalogue is intentionally world-readable.
- Every ownership policy compares `auth.uid()` with the row owner. Cross-user reads, edits, exports, PDF access, processing, and deletion return `404`.
- Clients can read their own statement rows, but cannot insert, update, or delete them directly. `create_statement` and `delete_statement` are the only write paths; `create_statement` builds the storage path from `auth.uid()` and the new document id, and a `NOT VALID` check constraint rejects any row whose path points outside its owner's folder.
- The processor also verifies that a document's storage path starts with the document owner's id before downloading it with the service role, so a database mistake cannot turn into a cross-tenant read.
- `profiles` exposes only `select` and column-scoped `update (display_name, company)` to authenticated clients. `plan_id` cannot be changed from the browser; only the signature-verified webhook path can change entitlements.
- `billing_subscriptions` is readable by its owner and writable only by the service role. Clients cannot insert a subscription, change a status, or grant themselves a plan.
- `billing_webhook_events` is service-role only. `apply_billing_event` is a `SECURITY DEFINER` RPC executable only by `service_role`; it rejects unknown plans and ignores duplicate `webhook-id` deliveries.
- The webhook verifies the Dodo signature against the raw request body before parsing anything. Invalid signatures return `401` and never touch entitlement state.
- Webhook payloads are triggers, not authority: the handler re-reads the subscription from the Dodo API before applying a plan, so a replayed or edited payload cannot invent a status.
- Checkout accepts only a plan slug (`starter`, `pro`, `business`). The Dodo product id is resolved on the server from the environment for the active mode; the browser cannot send a product id, price, or tier.
- Checkout and the customer portal both use the Dodo customer linked to the signed-in account. Card details are entered in Dodo's hosted checkout and never reach FlowParse.
- A delayed or superseded subscription event cannot overwrite the subscription that currently grants access; the database function and the sync layer both enforce this rule.
- Clients can read only their own `conversion_jobs` and `usage_records`; both tables are server-write-only.
- Transaction inserts and updates require `auth.uid() = user_id`, a document owned by the same user, and (when present) a `job_id` that belongs to that same document and user.
- `queue_conversion` and `fail_conversion` are `SECURITY DEFINER` RPCs for authenticated callers. They verify ownership, lock the document/job row, refuse to overwrite completed data, and create or fail the next attempt.
- The processor uses the service-role key and calls `save_extraction_result`, `mark_conversion_failed`, and `update_conversion_progress`. Those functions are not executable by `anon` or `authenticated`.
- The inline editor calls `apply_transaction_changes`, a security-definer RPC that validates `auth.uid()`, document ownership, and row ownership on every operation.
- Usage counters are maintained by triggers on document insert/delete and terminal status changes, then backfilled from existing data by the migration. Clients cannot write usage directly.
- PDFs live in the private `statements` bucket at `{user_id}/{document_id}/original.pdf`. Storage policies restrict each object to the owning user's folder.
- The browser uploads with a short-lived signed URL and never receives the service-role key. Original PDFs and exports are streamed only by authenticated Next.js routes.
- Hosted Storage sits behind a CDN that ignores `Cache-Control`/`Pragma` request headers, so the processor downloads each source PDF through a unique query string. Without that, replacing a damaged source object can keep serving the old bytes for up to an hour.
- CSV free-text cells are neutralized against spreadsheet formula injection.
- Uploads are limited to `application/pdf`; the storage bucket enforces the same MIME type and a 25 MiB cap. The plan's `file_size_mb` is also enforced by `POST /api/statements`.
- API responses use `Cache-Control: no-store` or `private, no-store`.
- Every response sets a Content Security Policy, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict referrer policy and a restrictive permissions policy. The CSP allows only the app origin and the configured Supabase origin for network calls.
- The processor's service-role key exists only in its runtime environment; never prefix it with `NEXT_PUBLIC_`.

---

## API surface

All web routes require an authenticated Supabase session unless noted.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/statements` | Load profile/plan, check allowance, create document, return signed upload URL |
| `GET` | `/api/statements/:id` | Load document and ordered transactions |
| `DELETE` | `/api/statements/:id` | Delete document, jobs, transactions, and stored PDF |
| `POST` | `/api/statements/:id/process` | Queue the next conversion attempt; returns `jobId`; completed conversions return `409` |
| `POST` | `/api/statements/:id/transactions` | Save upserts and deletes atomically |
| `GET` | `/api/statements/:id/file` | Stream the original private PDF |
| `GET` | `/api/statements/:id/export?format=csv` | Download CSV |
| `GET` | `/api/statements/:id/export?format=xlsx` | Download XLSX |
| `POST` | `/api/billing/checkout` | Create a hosted Dodo checkout session for `{ "plan": "starter" \| "pro" \| "business" }` |
| `POST` | `/api/billing/portal` | Create a Dodo customer-portal session for the linked customer |
| `POST` | `/api/webhooks/dodo` | Dodo subscription webhook; verified by signature, not by a user session |
| `GET` | `/health` (processor) | Health, configuration, and OCR readiness |
| `POST` | `/v1/jobs` (processor) | Queue extraction; requires `X-Processor-Key` |

The processor endpoints are not exposed through the Next.js app and should not be publicly browsable in production.

---

## Plans and usage tracking

Plans live in `subscription_plans`, so limits can be changed without a redeploy. The seed migration includes:

| Plan | Price | Processed pages / month | Files per batch | PDF size | Sold through checkout |
| --- | --- | --- | --- | --- | --- |
| Free | $0 | 3 | 1 | 25 MB | No |
| Starter | $9 | 100 | 5 | 25 MB | Yes |
| Pro | $19 | 1,000 | 10 | 25 MB | Yes |
| Business | $39 | 10,000 | 10 | 25 MB | Yes |

Processing limits remain: 100 pages per PDF, OCR enabled by default (English), and stale jobs marked failed after 20 minutes at processor startup.

`POST /api/statements` loads `profiles.plan_id`, reads the plan row, and compares the current month's `usage_records.pages_processed` with `subscription_plans.page_limit`. It rejects files larger than `file_size_mb`; the upload panel limits a batch to `batch_limit` files. `POST /api/statements/:id/process` repeats the allowance check for retries. The dashboard and settings page use the same profile/plan/usage loader.

`usage_records` is maintained by database triggers:

- a document insert increments `documents_uploaded` and `storage_bytes`;
- entering a completed or partial terminal state increments `conversions_completed` and adds the document's page count to the current month's `pages_processed`;
- entering a failed state increments `conversions_failed`;
- deleting a document decrements `documents_uploaded` and `storage_bytes`. Processed pages are **not** refunded: otherwise a user could process unlimited pages by uploading and deleting the same statement.

The migration backfills usage from existing data. Clients can read their own monthly record but cannot write it, and the processor does not update usage directly.

**Strict page cap.** `save_extraction_result` locks the current month's usage row, reads the plan limit, and refuses to save a completed or partial extraction when `pages_processed + page_count` would exceed the plan. The document is marked failed with an upgrade message and no rows are saved. This closes the previous window where a single 100-page PDF could be processed on the Free plan (3 pages), and where two concurrent extractions could both pass a pre-insert check. The page count is charged to the month in which processing finishes, not the month the file was uploaded. The allowance resets on the first day of each calendar month (UTC), not on the subscription anniversary.

The upload-time check is still a pre-check for user experience. The database guard is authoritative.

### Billing (Dodo Payments)

FlowParse uses [Dodo Payments](https://dodopayments.com) as the Merchant of Record. Checkout and the customer portal are hosted by Dodo, so FlowParse never sees or stores card data and tax is calculated by Dodo.

The products are recurring monthly subscriptions in the SaaS tax category:

| Plan | Price | Test product id | Live product id |
| --- | --- | --- | --- |
| FlowParse Free | $0 / month | `pdt_0Ns4djtqw9iALZUOZ0w2k` | `pdt_0Ns9z3yEsSqRX1OineSy0` |
| FlowParse Starter | $9 / month | `pdt_0Ns4djxmyAn482qBO58xA` | `pdt_0Ns9z45UMsX5TifM1LCse` |
| FlowParse Pro | $19 / month | `pdt_0Ns4dk6Po7usYQPic6suw` | `pdt_0Ns9z4AZO9D22qBezwbzJ` |
| FlowParse Business | $39 / month | `pdt_0Ns4dkALqGAkoaDG4Rr5d` | `pdt_0Ns9z4HcpH5OFIfXTLCT3` |

The test ids belong to the FlowParse test-mode business and the live ids to its live business. They are not interchangeable: every request uses the ids whose suffix matches `DODO_PAYMENTS_ENVIRONMENT`. The Free product exists for completeness and is not sold: the Free plan is the default entitlement when no paid subscription is active.

**Checkout.** The plan cards in Settings (and the pricing section) call `POST /api/billing/checkout` with a plan slug. The server validates the session, refuses to start a second subscription when one already grants access, resolves the product id from the environment for the current mode, creates or reuses the account's Dodo customer, and returns a hosted checkout URL. `/checkout/success` shows a confirming state until the webhook updates the account; it never activates a plan itself. `/settings?checkout=cancelled` explains that no charge was made.

**Webhook.** Dodo sends subscription events to `POST /api/webhooks/dodo` with `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers. The route verifies the signature over the raw body, ignores unrelated event types, and then:

1. re-reads the subscription from the Dodo API (the event is a trigger, not the source of truth);
2. maps the subscription to a FlowParse user through `metadata.app_user_id` or the previously linked `dodo_customer_id`;
3. resolves the entitled plan from the subscription status, cancellation flag, and period end;
4. calls `apply_billing_event` with the `webhook-id` as the idempotency key.

Handled events: `subscription.active`, `renewed`, `cancelled`, `expired`, `failed`, `on_hold`, `past_due`, `paused`, `unpaused`, `updated`, `plan_changed`, and `update_payment_method`.

Entitlement rules:

| Subscription state | Paid access |
| --- | --- |
| `active`, `past_due` | Yes, at the subscribed plan |
| `cancelled` with `cancel_at_next_billing_date` and a future period end | Yes, until the period end |
| `pending`, `failed`, `on_hold`, `paused`, `expired`, `cancelled` (period ended) | No; the account falls back to Free |

Because the webhook is idempotent, a retried delivery cannot apply a plan twice or duplicate a usage change. Delayed events older than the stored `last_event_at` are ignored, and an event from a superseded subscription cannot replace one that currently grants access.

**Customer portal.** `POST /api/billing/portal` creates a short-lived hosted session for the linked Dodo customer. "Manage subscription" opens it for invoices, payment-method updates, plan changes, and cancellation. A scheduled cancellation keeps access until the end of the paid period; Dodo sends `subscription.cancelled` once the period actually ends.

**Test mode.** `DODO_PAYMENTS_ENVIRONMENT` defaults to `test_mode`, and any value other than `live_mode` keeps test mode. The Dodo client is constructed with the matching environment, and product ids are resolved from the matching `_TEST`/`_LIVE` variables, so test and live configuration cannot be mixed by accident. Use Dodo's test cards (`4242 4242 4242 4242` for success, `4000 0000 0000 0341` for a decline) and the webhook relay shown above to exercise the lifecycle locally.

**Live mode.** FlowParse is deployed at `https://www.flowparse.app`, the four live products in the table above exist in the live business, and the live webhook endpoint `ep_3MFcC1CJgwhvyrRGwclbiRZAGAl` must be registered for `https://www.flowparse.app/api/webhooks/dodo`. The legacy `https://flowparse.vercel.app` host is kept as a canonical redirect for page routes, but the Dodo endpoint, Supabase Auth URLs and `NEXT_PUBLIC_SITE_URL` must all use the official www domain. Switching to live is a configuration change, not a code change:

1. Keep the app on a public HTTPS host, because Dodo cannot deliver live webhooks to `localhost`.
2. Register the live webhook for `https://www.flowparse.app/api/webhooks/dodo` and keep its signing secret in the host's secret store. Replace any endpoint still pointing at `flowparse.vercel.app`.
3. Set `DODO_PAYMENTS_ENVIRONMENT=live_mode`, the live API key, the live webhook secret, the four `_LIVE` product ids, and `NEXT_PUBLIC_SITE_URL=https://www.flowparse.app` for Production only. The site URL controls checkout return links and auth email redirects, so it must be the public origin rather than `localhost`. Keep the test values for development and preview environments.
4. In Supabase Auth, set the site URL to `https://www.flowparse.app` and add `https://www.flowparse.app/auth/confirm` to the redirect allow list.
5. Confirm the deployment reports a live-mode Dodo client, that the four `_LIVE` ids resolve, and that an unsigned webhook is rejected with `401`.

Never put live credentials in a committed file or a client bundle, and never reuse test product ids with live credentials. A live checkout charges a real card, so it is a customer action; validate the flow with a real low-value purchase only when you are ready to take payments.

---

## SEO and content

The public marketing surface is built from typed content modules rather than hand-written copies of the same template.

| Route | Purpose | Rendering |
| --- | --- | --- |
| `/` | Product landing page | Server-rendered (auth-aware CTA) |
| `/<conversion-slug>` | Nine solution pages (`convert-bank-statement-pdf-to-excel`, `bank-statement-ocr`, `bank-statement-converter-for-accountants`, and so on) | Static |
| `/banks` | Index of bank-specific guides | Static |
| `/banks/[slug]` | Bank statement guide for a tested layout | SSG (`generateStaticParams`) |
| `/resources` | Guide index | Static |
| `/resources/[slug]` | Long-form article template | SSG |
| `/sitemap.xml` | XML sitemap generated from the same content modules | Metadata route |
| `/robots.txt` | Crawl policy and sitemap reference | Metadata route |
| `/opengraph-image` | Generated 1200×630 social card | Image route |

Technical SEO lives in `src/lib/seo/` and `src/components/seo/`:

- `site.ts` holds the canonical origin, site name and absolute-URL helper. `NEXT_PUBLIC_SITE_URL` must be the public production origin; the fallback is `https://www.flowparse.app`.
- `metadata.ts` builds per-page canonical, Open Graph and Twitter metadata.
- Each landing page, article and bank guide emits JSON-LD: `WebPage`/`BlogPosting`, `BreadcrumbList` and `FAQPage`. The home page emits `Organization`, `WebSite` and `SoftwareApplication`.
- The marketing shell is static: it does not read cookies, so content pages are prerendered and cached.
- `sitemap.ts` includes only public, indexable content. Auth and app routes are excluded by `robots.ts`.

### Adding a landing page

1. Add a `LandingPageContent` object to one of the modules in `src/lib/seo/landing/` (or add a new module and export it from `index.ts`).
2. Create `src/app/(marketing)/<slug>/page.tsx` using the existing landing-page template. The route uses the shared metadata helper and renders `LandingPageView`.
3. Add the slug to internal links where it is relevant, and to the sitemap automatically via `LANDING_PAGES`.

Use a new page only for a distinct search intent. Do not create near-duplicate pages for every phrasing of the same query; the nine solution pages cover different intents and should not be multiplied artificially.

### Adding a bank page

Bank pages are intentionally gated on tested layouts:

1. Add a parser fixture for the bank and assert its profile and reconciliation in the processor tests.
2. Add the bank to `BANK_PAGES` in `src/lib/seo/banks.ts` with the profile defaults, the tested layouts and an independence disclaimer.
3. The `/banks/[slug]` route, sitemap entry, bank index card and footer link are generated from the registry.

Never add a bank page based only on a name in the profile registry. The page must state what was tested and must not imply affiliation or guaranteed accuracy.

### Adding an article

Add an `ArticleContent` object to `src/lib/seo/articles/`, export it from `index.ts`, and the index page, related links and sitemap update automatically. Articles should include a unique introduction, sections with substantive detail, an FAQ and links to the relevant solution pages. Avoid publishing the same article under multiple titles.


---

## Testing

The repository ships with synthetic fixtures and automated parser/unit tests. Fixtures are generated at test time, so no customer data is stored in the repository.

```bash
# Web checks
npx tsc --noEmit
npm run lint
npm run test:web
npm run build

# Responsive public/auth pages (requires `npm run dev` and Chrome)
npm run test:responsive

# Processor checks
cd services/processor
python -m pytest -q
```

The web suite (`npm run test:web`, 42 tests) covers:

- CSV header, ISO dates, dot-decimal amounts, negative balances, per-row currencies, empty exports, and formula-injection neutralisation;
- XLSX summary and transaction sheets, real date cells, numeric amounts, review notes, and formula-like descriptions stored as plain strings;
- live reconciliation totals, negative balances, incomplete rows, and amount parsing (including European, grouped and parenthesised manual input);
- transaction and upload Zod validation;
- auth error mapping that avoids account-existence disclosure and explains rate limits and confirmation failures;
- statement create/delete API routes: authentication, malformed input, RPC failure, signed-URL failure cleanup, and storage removal;
- canonical site URL fallback to `https://www.flowparse.app`, trailing-slash handling and absolute URLs;
- plan limits, UTC month boundaries, billing entitlement rules, and safe post-login redirects.

The processor suite covers:

- digital, US, European, value-date/reference, inline value-date, year-end yearless dates, headerless, duplicate, unsupported, and scanned layouts;
- overdrawn balances, parenthesis negatives, separate `DR`/`CR` markers, grouped integers, space-grouped European amounts, Swiss apostrophes, and Indian grouping;
- reversed debit/credit columns, multi-page statements without repeated headers, and missing transactions that must produce a reconciliation mismatch;
- statements with no stated balances, which must return `insufficient_data` rather than a false `verified` status;
- a transaction description such as `PAYMENT TO WWW.AMAZON.COM` or `TRANSFER TO CLOSING BALANCE ACCOUNT`, which must not be dropped or mistaken for a balance endpoint;
- separate ISO currency codes next to amounts, a bare `$` on a non-USD statement, and duplicate detection that treats different currencies as distinct;
- mixed-currency totals that are kept and flagged but never reported as verified;
- queue claiming, claim races, worker recovery, and queued/embedded API dispatch;
- date-order inference, year-end date alignment, and dashed/named month parsing;
- international amount grouping, currency symbols, ISO prefixes/suffixes, and ambiguous `$`;
- password-protected and corrupt PDFs;
- low-OCR-confidence flags and forced `partial` status;
- bank profile detection;
- reconciliation, duplicate detection, and validation checks;
- monotonic real progress stages and tolerance of progress-sink failures;
- storage-path ownership checks that prevent the processor from reading outside the document owner's folder.

The responsive suite (`npm run test:responsive`, 51 checks) loads the landing page, auth pages, bank index/detail, resources index/article and a solution page at 390, 640, 768, 1024 and 1440 px. It fails on horizontal page overflow (ignoring intentional scroll containers), console errors, failed navigations, or a broken mobile menu. It uses an installed Chrome through `playwright-core`; set `PLAYWRIGHT_CHROME_PATH` if Chrome is not on the default channel.

The database integration suite (`services/processor/tests/test_database_security.py`, 15 tests) runs against a disposable migrated Postgres/Supabase database and verifies:

- statement creation and deletion are RPC-only; direct insert/update/delete is denied;
- a client cannot forge status, page count, validation, or a storage path;
- cross-user document, profile, job, and usage reads/writes are blocked;
- storage objects are readable only from the owner's folder, and a client cannot upload into another user's folder;
- transaction rows cannot reference another user's job or document;
- the editor RPC is owner-only and does not report a derived opening balance or mixed-currency totals as verified;
- a 100-page statement is rejected on the Free plan before any rows are saved;
- the page cap is cumulative, charged to the processing month, and not refunded on delete;
- a late failure or duplicate save cannot overwrite a completed extraction.

Run it against a local Supabase database after `npx supabase db reset`:

```bash
cd services/processor
FLOWPARSE_TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:56322/postgres" python -m pytest -q tests/test_database_security.py
```

In PowerShell:

```powershell
$env:FLOWPARSE_TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:56322/postgres"
python -m pytest -q tests/test_database_security.py
```

The test uses two fixed test users, deletes their rows before and after each test, and refuses to run unless `FLOWPARSE_TEST_DATABASE_URL` is set. Do not point it at production.

The billing lifecycle was exercised end-to-end in Dodo test mode with the webhook relay:

- plan cards start a hosted checkout for the selected plan only;
- a successful card activates the plan after the signed webhook arrives, not on redirect;
- an unsigned or tampered webhook is rejected with `401`;
- a duplicate `webhook-id` is a no-op (the plan and event table stay unchanged);
- a renewal advances the stored period end and keeps the plan;
- a scheduled cancellation keeps access until the period end, and a cancellation that takes effect downgrades to Free;
- a declined first payment leaves the account on Free with a `failed` subscription;
- a declined renewal moves the subscription to `on_hold` and revokes paid access;
- the customer portal lists invoices and subscriptions and can update the payment method.

Regenerate fixtures and inspect a result without the UI:

```bash
cd services/processor
python -c "from tests.fixtures.generate import generate_all; print(generate_all())"
python -m app.cli tests/fixtures/barclays-value-date.pdf
```

Manual regression checklist:

1. Sign up, sign out, sign in, request a reset email, and choose a new password.
2. Upload a digital PDF; verify it reaches **Extracted** with the expected row count, value dates, references, currencies, and a reconciled balance.
3. Upload an overdrawn statement (negative opening/closing balances and parenthesised or `DR` balances); verify the signs are preserved and the statement reconciles.
4. Upload a statement with whole/space-grouped amounts and a statement with no printed balances; verify the amounts parse and the no-balance result shows **Not verifiable** rather than a false **Balanced**.
5. Upload a scanned PDF and verify OCR is used, confidence is at most **medium**, and low-confidence pages produce flagged rows and a **Needs review** status.
6. Upload a statement containing duplicate rows and verify both rows are kept, flagged, and counted in the duplicate check.
7. Edit a description, value date, and row currency in the ledger, save, refresh, and confirm they persisted.
8. Add a manual row, save, delete it, save again, and confirm the row count returns.
9. Upload a batch containing valid, scanned, and unsupported PDFs; confirm each shows a real stage and percentage, the unsupported file ends **Failed** with a clear error, retry is available inline, and retrying does not duplicate rows.
10. Retry a completed conversion and confirm the API returns `409` instead of overwriting reviewed data.
11. Download XLSX and CSV; verify the files open, include value dates and per-row currencies, and reconcile with the summary.
12. Sign in as a second account and confirm the first account's statement pages/API/files/exports all return `404`.
13. Confirm the dashboard, history, and settings counts match the database, including the current-month page count after processing a statement uploaded last month.
14. On the Free plan, upload a 100-page PDF and confirm it fails with the monthly allowance message before any rows are saved. Delete a completed statement and confirm the processed pages are not refunded.
15. Start a checkout, cancel it, and confirm the settings banner appears and the plan did not change.
16. Complete a test-mode checkout with `4242 4242 4242 4242`, confirm the success page waits for the webhook, then confirm Settings shows the new plan, page allowance, and renewal date. Open the customer portal and confirm the invoice is listed.
17. Check the landing, auth, dashboard, history, settings, and statement workspace at 390, 640, 768, 1024, and 1440 px widths.

Lighthouse checks were used during development to bring the landing, auth, dashboard, history, settings, and statement workspace pages to **100 accessibility, 100 best practices, and 100 SEO**.

---

## Deployment

### 1. Supabase

Create a hosted Supabase project, then apply the migrations:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

The latest migration (`20260106000000_security_and_usage_hardening.sql`) moves statement creation/deletion behind ownership-checked RPCs, tightens transaction RLS, adds the storage-path and currency checks, and enforces the monthly page cap at save time. Apply it before deploying the matching application build. Like the earlier migrations, it is intended to run once through the normal `db push` flow.

In **Authentication → URL Configuration**, set the site URL to `https://www.flowparse.app` and add:

```text
https://www.flowparse.app/auth/confirm
```

Set up production SMTP for auth emails; local Mailpit is development-only. The local `supabase/config.toml` disables email confirmation for convenience; enable it in the hosted project before taking real users, and keep the password minimum at 8 characters. The migrations create the private bucket, MIME restriction, storage policies, profile trigger, plan catalogue, usage triggers, conversion jobs, billing mirror and webhook receipt tables, and all RPCs. Review the bucket size cap and the app's `MAX_FILE_BYTES` together if you change limits.

After `db push`, confirm that `subscription_plans` contains the seeded `free` plan and that `profiles` has a row for every existing auth user. New signups create their profile automatically through the `on_auth_user_created` trigger.

Set `NEXT_PUBLIC_SITE_URL=https://www.flowparse.app` for Production. Next inlines `NEXT_PUBLIC_*` values at build time, so set it before the production build and redeploy after changing it. The `/auth/confirm` route also derives the request origin from forwarded headers so cookie exchange works on the same host, but the explicit production origin is what keeps auth emails, canonical URLs and checkout return links on the official domain.

### 2. Vercel project

Use `www.flowparse.app` as the primary production domain and keep `flowparse.app` redirecting to it (Vercel already returns a 308 from the apex). The deployment host `flowparse.vercel.app` also remains reachable; the middleware sends its page routes to `https://www.flowparse.app` while leaving `/api/` and `/auth/` paths on the alias so an in-flight webhook or confirmation link is not broken during the change. Update the Dodo webhook endpoint to the www domain as soon as the new deployment is live.

This repository deploys as one Vercel project with two services and one daemon,
defined in `vercel.json`:

| Resource | Type | Root | Public | Purpose |
| --- | --- | --- | --- | --- |
| `app` | Service | `.` | Yes, at `/` | Next.js application |
| `processor` | Service | `services/processor` | No | Containerised FastAPI job API and health endpoint |
| `processor-worker` | Daemon | `services/processor` | No | Claims queued jobs and runs extraction continuously |

Import the repository as a **multi-service project** so Vercel reads
`vercel.json`; do not import `app` and `processor` as separate single projects.
The `app` service declares a binding to `processor`, so Vercel injects the
processor's internal URL as `PROCESSOR_URL` at runtime. Do not set
`PROCESSOR_URL` in the Vercel project environment; remove any existing value.
Bindings resolve only in server-side functions at runtime, not during builds or
in middleware.

The processor service and worker both use `services/processor/Dockerfile`, so
Tesseract is available. The container listens on `$PORT` with a default of
`8000`, while Vercel routes container traffic to port `80` by default. Set
`PORT=8000` in the Vercel project environment so the router reaches the
processor; the Next.js service does not use that value for its own routing. The
worker is pinned to `iad1` in `vercel.json`; change that region if your Supabase
project runs elsewhere.

In production, `PROCESSING_MODE=queued`: the processor API validates a job and
returns `202`, while `processor-worker` claims it from `conversion_jobs` and runs
extraction. In preview and development, the daemon is not available, so use
`PROCESSING_MODE=embedded` and the processor API runs the job in its own thread
pool. Set the variable per Vercel environment; the code falls back to `queued`
only when `VERCEL_ENV=production` is available.

Configure these environment variables for the project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL` (processor; use the same project URL)
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROCESSOR_API_KEY`
- `PORT=8000`
- `PROCESSING_MODE=queued` for Production, `PROCESSING_MODE=embedded` for Preview and Development
- `NEXT_PUBLIC_SITE_URL`
- `DODO_PAYMENTS_ENVIRONMENT`
- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_KEY`
- `DODO_PRODUCT_STARTER_TEST` / `DODO_PRODUCT_STARTER_LIVE`
- `DODO_PRODUCT_PRO_TEST` / `DODO_PRODUCT_PRO_LIVE`
- `DODO_PRODUCT_BUSINESS_TEST` / `DODO_PRODUCT_BUSINESS_LIVE`

Set the project's Node.js version to **22** (the repository declares `engines.node >= 22`). Node 20 is no longer supported by the installed Supabase SDK.

`PROCESSOR_API_KEY` must be identical for the app and processor. Set the shared
values for Production, Preview, and Development. `NEXT_PUBLIC_*` values are
inlined at build time, so changing them requires a new deployment.

Each service owns its build: Vercel builds the Next.js app with `npm run build`,
and builds the processor and worker from the same Dockerfile. The export route
requires the Node.js runtime and keeps `exceljs` external; this is configured in
`next.config.ts`.

To test the full Vercel service wiring, run `vercel dev` (Docker is required for
the container service). The daemon is production-only and does not run under
`vercel dev`; development therefore uses `embedded` mode. When using
`vercel dev`, leave `PROCESSOR_URL` unset in `.env.local` so the injected
binding is used. For day-to-day development, the two-process setup in
[Local development](#local-development) is unchanged.

### 3. Dodo Payments

1. Create the Starter, Pro, and Business products as **recurring monthly** subscriptions in the SaaS tax category (and optionally a $0 Free product), in test mode first. A monthly plan that should renew until cancelled needs `subscription_period_count` greater than one (or none) and `subscription_period_interval` set to the plan's interval; a single period expires after one month.
2. Copy the product ids into `DODO_PRODUCT_*_TEST`, and set `DODO_PAYMENTS_ENVIRONMENT=test_mode`.
3. Add a webhook endpoint in Dodo pointing to `https://your-app.example.com/api/webhooks/dodo`, subscribe it to the subscription events, and copy the signing secret into `DODO_PAYMENTS_WEBHOOK_KEY`.
4. Complete a test-mode checkout end-to-end, including the webhook relay or a public tunnel, before enabling live mode.
5. For production, use the FlowParse live products listed in [Billing](#billing-dodo-payments) (they already exist), set the `_LIVE` ids, switch `DODO_PAYMENTS_ENVIRONMENT=live_mode`, register the live webhook endpoint, and use the live API key and live webhook secret.

Keep the test and live values in different environments. Do not reuse test product ids with live credentials, and do not enable live mode until the checkout, webhook, renewal, cancellation, and portal flows have been verified in test mode.

### 4. Python processor and worker

The `processor` service is internal and has no public rewrite, so only the `app`
service can reach it through the binding. The `processor-worker` daemon runs the
same container image with `python -m app.worker`. It polls the oldest queued
`conversion_jobs` rows, claims one atomically, and runs the existing extraction
pipeline with progress reporting and result saving. The app continues to poll
the authenticated API exactly as before, so the user-facing flow does not
change.

Production requirements:

- Outbound HTTPS to Supabase.
- Enough memory for OCR page rendering; OCR jobs are CPU- and memory-heavy.
- `PROCESSOR_API_KEY` matching the app service.
- `SUPABASE_SERVICE_ROLE_KEY` supplied as a secret.
- `PORT=8000` so Vercel routes to the container's Uvicorn listener.
- `PROCESSING_MODE=queued` in production; use `embedded` in Preview/Development.
- The Supabase and processing variables listed in the environment section.

Vercel Daemons currently run only in production deployments. Preview and
development deployments use `embedded` mode, which processes queued jobs inside
the processor service. The same image can also run as a normal long-running
container; `embedded` mode remains the default outside production:

```bash
docker build -t flowparse-processor services/processor
docker run --env-file services/processor/.env -p 8000:8000 flowparse-processor
```

To exercise the queued worker path locally, set `PROCESSING_MODE=queued` for the
service and run the worker command alongside it:

```bash
docker run --env-file services/processor/.env flowparse-processor python -m app.worker
```

If the worker is stopped, queued jobs remain in `conversion_jobs` and are picked
up when it restarts. Jobs stuck in `processing` for longer than
`STALE_JOB_MINUTES` are marked failed at worker startup, so an interrupted job
does not stay in progress forever; queued jobs are left for the worker. In all
deployments, keep the processor off the public internet. The shared secret is a
service credential, not a user credential.

### 5. Post-deploy smoke test

1. Create an account and upload one digital and one scanned statement.
2. Confirm processing reaches a terminal state and the reconciliation values look correct.
3. Edit a row, save, reload, and export both formats.
4. Test password recovery from a real email inbox.
5. Sign in as a second user and verify complete data isolation.
6. Run one test-mode checkout and confirm the webhook activates the plan; then cancel it and confirm access ends at the period end.
7. Check `processor-worker` logs for claimed jobs and completed or failed extractions.
8. Confirm the processor service has no public URL and that `/api/statements/:id/process` works through the binding.
9. Check logs for failed extraction, billing webhook signature failures, or processor credential errors.

### 6. Vercel build troubleshooting

- **`Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY` during the build.** Add both variables to the Vercel project for Production, Preview, and Development, then redeploy. They are inlined into the client bundle at build time. The authenticated route group is explicitly dynamic, so it is not prerendered, but the app still needs these values at runtime.
- **`Edge Runtime is not supported in services`.** Next.js middleware defaults to Edge, which Vercel Services cannot deploy. `src/middleware.ts` sets `runtime: "nodejs"` in its `config` export; keep that setting if you edit the matcher.
- **`PROCESSOR_URL` should not be set manually.** The `app` service binding injects it. Remove any manually configured value.
- **The processor container is unreachable.** Confirm `PORT=8000` is set for the project and that the processor service is internal rather than expected at a public URL.

---

## Known limitations and production hardening

This is an MVP with deliberate scope boundaries:

- **Heuristic extraction.** The parser is layout-aware and now uses declarative bank profiles, but it is not bank-universal. Statement layouts it does not recognize produce partial results, flagged rows, or a failed extraction with an explanation. Unresolved lines are listed in the extraction report rather than invented. Expand the synthetic fixture corpus before claiming broad bank coverage, and follow [`docs/adding-a-bank.md`](docs/adding-a-bank.md) for bank-specific conventions.
- **Database-backed job queue.** Production uses the `processor-worker` daemon, which polls `conversion_jobs`; local and preview deployments use an in-process thread pool. Jobs are claimed atomically, and interrupted processing jobs are recovered as failed at worker startup, but there is no durable broker or automatic retry. Use a queue such as SQS/Redis and idempotent workers for higher scale.
- **Best-effort monthly quota.** The allowance is checked before insertion. Two simultaneous uploads at the limit could exceed it by one. Move the check and insert into a single transactional RPC if strict enforcement is required.
- **Billing is monthly-plan only.** Plan changes, proration, and mid-cycle upgrades are handled in the Dodo customer portal rather than an in-app comparison flow. Page allowances reset on the calendar month, not on the subscription anniversary, so a mid-month subscription starts with a fresh allowance.
- **Webhook recovery relies on Dodo retries.** A failed webhook returns `5xx` so Dodo redelivers, and processed ids make redelivery safe, but there is no local replay queue. Events that cannot be mapped to a FlowParse user are acknowledged and logged instead of guessed, so a customer created outside the checkout flow needs its `app_user_id` metadata or a linked customer row.
- **No malware scanning.** PDFs are validated structurally by the parser and stored privately, but they are not virus-scanned. Add object scanning/quarantine before processing untrusted files at scale.
- **Storage cleanup is best-effort.** Deleting a statement removes the database row and attempts to remove the object. If storage deletion fails, the object remains private and unreachable; add a lifecycle job to remove orphans.
- **Retention and deletion policy.** There is no automated retention schedule or self-service account deletion yet. Define these before handling regulated financial data.
- **OCR language coverage.** English is the default and only packaged model. Install additional Tesseract language data and expose the setting if needed.
- **Polling, not realtime.** The workspace polls the authenticated API. This is simple and reliable for the MVP but not as efficient as Supabase Realtime or server-sent events at scale.
- **No MFA, team workspaces, audit log, or granular roles.** The data model is per-user and single-tenant by design.
- **Processor availability.** If the processor API is down, submitting a new statement shows an error; if the worker is down, queued statements wait until it restarts. Manual data entry and exports of existing statements still work.
- **Production auth email.** Password reset depends on configured SMTP and the correct redirect allow-list. Test both after any domain change.

Before a commercial launch, add monitoring and alerting for processor errors, queue depth, failed extractions, storage growth, and auth email delivery. Rotate the processor shared secret and Supabase service-role key on a schedule, and keep them out of client bundles and logs.

---

## Scripts

```bash
npm run dev       # Next.js development server with Turbopack
npm run build     # Production build
npm start         # Production server
npm run lint      # ESLint
```

Python processing, tests, and CLI commands are documented above.

---

## Status

FlowParse is functionally complete as an MVP: upload, digital and scanned extraction, value-date/reference/currency fields, reconciliation, duplicate review, editable preview, secure exports, history, authentication, password recovery, page-based usage limits, subscription billing with Dodo Payments, and per-user isolation have all been exercised end-to-end. The remaining work is commercial hardening rather than core functionality.
