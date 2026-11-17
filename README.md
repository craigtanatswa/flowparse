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
2. `POST /api/statements` verifies authentication, loads the user's profile and subscription plan, checks the monthly allowance from `usage_records`, inserts an ownership-scoped `uploaded_documents` row, and returns a signed upload URL for `{user_id}/{document_id}/original.pdf`.
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

The processor is an independent long-running service. Next.js only submits jobs; it does not download or parse PDFs itself. This keeps OCR memory and CPU usage off the web tier.

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
validation and in the extraction report.

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
    statements/                  Ledger editor, reconciliation, report, detail shell
    ui/                          Shared UI primitives
  lib/
    supabase/                    Browser, server, middleware, and admin clients
    account.ts                   Profile, subscription plan, and usage loader
    billing.ts                   Entitlement rules and status labels (pure)
    billing-sync.ts              Authoritative Dodo re-read and idempotent apply
    dodo.ts                      Server-only Dodo client and product mapping
    plans.ts                     Plan catalogue helpers and allowance formatting
    validation.ts                Zod request schemas
    export.ts                    CSV and XLSX generation
public/
  brand/                         Logo lockups, glyphs, and app icon assets
supabase/
  config.toml                    Local Supabase ports and auth settings
  migrations/                    Schema, RLS, storage, triggers, and RPCs
services/processor/
  app/main.py                    FastAPI health and job endpoints
  app/jobs.py                    Job manager and extraction execution
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
    test_parser.py               End-to-end layout and error tests
    test_amounts.py              Amount/currency unit tests
    test_dates.py                Date parsing unit tests
    test_validation.py           Reconciliation and duplicate tests
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

- **Node.js 20+** and npm
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
| `PROCESSOR_URL` | Yes for extraction | Base URL of the Python service |
| `PROCESSOR_API_KEY` | Yes for extraction | Shared secret sent as `X-Processor-Key` |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical URL used in auth email redirects and checkout return URLs |
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
| `PROCESSOR_WORKERS` | `2` | Concurrent extraction threads |
| `MAX_PAGES` | `100` | Page cap per PDF |
| `MAX_FILE_MB` | `25` | Processing file-size cap |
| `OCR_ENABLED` | `true` | Enable scanned-page OCR |
| `TESSERACT_CMD` | empty | Explicit Tesseract path; empty means PATH or platform default |
| `OCR_DPI` | `300` | OCR render resolution |
| `TESSERACT_LANG` | `eng` | OCR language |
| `STALE_JOB_MINUTES` | `20` | Age after which interrupted jobs are marked failed at startup |

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
- `profiles` exposes only `select` and column-scoped `update (display_name, company)` to authenticated clients. `plan_id` cannot be changed from the browser; only the signature-verified webhook path can change entitlements.
- `billing_subscriptions` is readable by its owner and writable only by the service role. Clients cannot insert a subscription, change a status, or grant themselves a plan.
- `billing_webhook_events` is service-role only. `apply_billing_event` is a `SECURITY DEFINER` RPC executable only by `service_role`; it rejects unknown plans and ignores duplicate `webhook-id` deliveries.
- The webhook verifies the Dodo signature against the raw request body before parsing anything. Invalid signatures return `401` and never touch entitlement state.
- Webhook payloads are triggers, not authority: the handler re-reads the subscription from the Dodo API before applying a plan, so a replayed or edited payload cannot invent a status.
- Checkout accepts only a plan slug (`starter`, `pro`, `business`). The Dodo product id is resolved on the server from the environment for the active mode; the browser cannot send a product id, price, or tier.
- Checkout and the customer portal both use the Dodo customer linked to the signed-in account. Card details are entered in Dodo's hosted checkout and never reach FlowParse.
- A delayed or superseded subscription event cannot overwrite the subscription that currently grants access; the database function and the sync layer both enforce this rule.
- Clients can read only their own `conversion_jobs` and `usage_records`; both tables are server-write-only.
- Transaction inserts require `auth.uid() = user_id`, a document owned by the same user, and a `job_id` that belongs to that document when present.
- `queue_conversion` and `fail_conversion` are `SECURITY DEFINER` RPCs for authenticated callers. They verify ownership, lock the document/job row, refuse to overwrite completed data, and create or fail the next attempt.
- The processor uses the service-role key and calls `save_extraction_result`, `mark_conversion_failed`, and `update_conversion_progress`. Those functions are not executable by `anon` or `authenticated`.
- The inline editor calls `apply_transaction_changes`, a security-invoker RPC that runs under the user's RLS context.
- Usage counters are maintained by triggers on document insert/delete and terminal status changes, then backfilled from existing data by the migration. Clients cannot write usage directly.
- PDFs live in the private `statements` bucket at `{user_id}/{document_id}/original.pdf`. Storage policies restrict each object to the owning user's folder.
- The browser uploads with a short-lived signed URL and never receives the service-role key. Original PDFs and exports are streamed only by authenticated Next.js routes.
- Hosted Storage sits behind a CDN that ignores `Cache-Control`/`Pragma` request headers, so the processor downloads each source PDF through a unique query string. Without that, replacing a damaged source object can keep serving the old bytes for up to an hour.
- CSV free-text cells are neutralized against spreadsheet formula injection.
- Uploads are limited to `application/pdf`; the storage bucket enforces the same MIME type and a 25 MiB cap. The plan's `file_size_mb` is also enforced by `POST /api/statements`.
- API responses use `Cache-Control: no-store` or `private, no-store`.
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
| Pro | $19 | 400 | 10 | 25 MB | Yes |
| Business | $39 | Unlimited | 10 | 25 MB | Yes |

Processing limits remain: 100 pages per PDF, OCR enabled by default (English), and stale jobs marked failed after 20 minutes at processor startup.

`POST /api/statements` loads `profiles.plan_id`, reads the plan row, and compares the current month's `usage_records.pages_processed` with `subscription_plans.page_limit`. It rejects files larger than `file_size_mb`; the upload panel limits a batch to `batch_limit` files. `POST /api/statements/:id/process` repeats the allowance check for retries. The dashboard and settings page use the same profile/plan/usage loader.

`usage_records` is maintained by database triggers:

- a document insert increments `documents_uploaded` and `storage_bytes`;
- a terminal status change increments `conversions_completed` or `conversions_failed`; a completed or partial conversion adds the document's page count to `pages_processed`;
- deleting a document decrements `documents_uploaded` and `storage_bytes`, and removes its processed pages.

The migration backfills usage from existing documents. Clients can read their own monthly record but cannot write it, and the processor does not update usage directly.

The allowance resets on the first day of each calendar month, not on the subscription anniversary. The check is a pre-insert read, so two simultaneous uploads at the exact limit could exceed it by a page or two; move the check and insert into a single transactional RPC if strict enforcement is required.

### Billing (Dodo Payments)

FlowParse uses [Dodo Payments](https://dodopayments.com) as the Merchant of Record. Checkout and the customer portal are hosted by Dodo, so FlowParse never sees or stores card data and tax is calculated by Dodo.

The products are recurring monthly subscriptions in the SaaS tax category:

| Plan | Price | Product id (test mode) |
| --- | --- | --- |
| FlowParse Free | $0 / month | `pdt_0Ns4djtqw9iALZUOZ0w2k` |
| FlowParse Starter | $9 / month | `pdt_0Ns4djxmyAn482qBO58xA` |
| FlowParse Pro | $19 / month | `pdt_0Ns4dk6Po7usYQPic6suw` |
| FlowParse Business | $39 / month | `pdt_0Ns4dkALqGAkoaDG4Rr5d` |

These ids belong to the FlowParse test-mode business. Live products must be created separately and stored in the `_LIVE` variables; the test ids above must never be used with live credentials. The Free product exists for completeness and is not sold: the Free plan is the default entitlement when no paid subscription is active.

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

---

## Testing

The repository ships with synthetic fixtures and automated parser/unit tests. Fixtures are generated at test time, so no customer data is stored in the repository.

```bash
# Web checks
npx tsc --noEmit
npm run lint
npm run build

# Python checks
cd services/processor
python -m pytest -q
```

The processor suite currently contains 33 tests covering:

- digital, US, European, value-date/reference, inline value-date, year-end yearless dates, headerless, duplicate, unsupported, and scanned layouts;
- date-order inference, year-end date alignment, and dashed/named month parsing;
- international amount grouping, currency symbols, ISO prefixes/suffixes, and ambiguous `$`;
- password-protected and corrupt PDFs;
- low-OCR-confidence flags and forced `partial` status;
- bank profile detection;
- reconciliation, duplicate detection, and validation checks;
- monotonic real progress stages and tolerance of progress-sink failures.

The end-to-end smoke test uploads a four-file batch (two digital, one scanned, one unsupported), verifies live stage/percentage progress, retries the failed file twice, confirms repaired retries complete without duplicate rows, checks completed jobs return `409`, edits rows, and downloads both CSV and XLSX.

A backend security test signs up two isolated users and verifies:

- profiles are created automatically on signup and start on the Free plan;
- users can update their own `display_name` but cannot change `plan_id`;
- cross-user profile reads and updates are blocked;
- the plan catalogue is readable and the private bucket is not;
- one user cannot read, delete, or process another user's document through RLS or the API;
- `conversion_jobs` and `usage_records` are owner-readable and server-write-only;
- transaction inserts cannot target another user's document or spoof `user_id`;
- storage objects require the owner or a signed URL, and a signed URL returns the exact file bytes.

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
3. Upload a scanned PDF and verify OCR is used, confidence is at most **medium**, and low-confidence pages produce flagged rows and a **Needs review** status.
4. Upload a statement containing duplicate rows and verify both rows are kept, flagged, and counted in the duplicate check.
5. Edit a description, value date, and row currency in the ledger, save, refresh, and confirm they persisted.
6. Add a manual row, save, delete it, save again, and confirm the row count returns.
7. Upload a batch containing valid, scanned, and unsupported PDFs; confirm each shows a real stage and percentage, the unsupported file ends **Failed** with a clear error, retry is available inline, and retrying does not duplicate rows.
8. Retry a completed conversion and confirm the API returns `409` instead of overwriting reviewed data.
9. Download XLSX and CSV; verify the files open, include value dates and per-row currencies, and reconcile with the summary.
10. Sign in as a second account and confirm the first account's statement pages/API/files/exports all return `404`.
11. Confirm the dashboard, history, and settings counts match the database.
12. Start a checkout, cancel it, and confirm the settings banner appears and the plan did not change.
13. Complete a test-mode checkout with `4242 4242 4242 4242`, confirm the success page waits for the webhook, then confirm Settings shows the new plan, page allowance, and renewal date. Open the customer portal and confirm the invoice is listed.
14. Check the landing and authenticated pages at desktop and mobile widths.

Lighthouse checks were used during development to bring the landing, auth, dashboard, history, settings, and statement workspace pages to **100 accessibility, 100 best practices, and 100 SEO**.

---

## Deployment

### 1. Supabase

Create a hosted Supabase project, then apply the migrations:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

In **Authentication → URL Configuration**, set the site URL to your production app URL and add:

```text
https://your-app.example.com/auth/confirm
```

Set up production SMTP for auth emails; local Mailpit is development-only. The migrations create the private bucket, MIME restriction, storage policies, profile trigger, plan catalogue, usage triggers, conversion jobs, billing mirror and webhook receipt tables, and all RPCs. Review the bucket size cap and the app's `MAX_FILE_BYTES` together if you change limits.

After `db push`, confirm that `subscription_plans` contains the seeded `free` plan and that `profiles` has a row for every existing auth user. New signups create their profile automatically through the `on_auth_user_created` trigger.

If you use the optional `NEXT_PUBLIC_SITE_URL`, set it to the canonical HTTPS origin. The `/auth/confirm` route also derives the request origin from forwarded headers so cookie exchange works on the same host.

### 2. Next.js

Deploy the repository to Vercel or another Node.js host. Configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROCESSOR_URL`
- `PROCESSOR_API_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `DODO_PAYMENTS_ENVIRONMENT`
- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_KEY`
- `DODO_PRODUCT_STARTER_TEST` / `DODO_PRODUCT_STARTER_LIVE`
- `DODO_PRODUCT_PRO_TEST` / `DODO_PRODUCT_PRO_LIVE`
- `DODO_PRODUCT_BUSINESS_TEST` / `DODO_PRODUCT_BUSINESS_LIVE`

Build with `npm run build` and start with `npm start`. The export route requires the Node.js runtime and keeps `exceljs` external; this is configured in `next.config.ts`.

### 3. Dodo Payments

1. Create the Starter, Pro, and Business products as **recurring monthly** subscriptions in the SaaS tax category (and optionally a $0 Free product), in test mode first. A monthly plan that should renew until cancelled needs `subscription_period_count` greater than one (or none) and `subscription_period_interval` set to the plan's interval; a single period expires after one month.
2. Copy the product ids into `DODO_PRODUCT_*_TEST`, and set `DODO_PAYMENTS_ENVIRONMENT=test_mode`.
3. Add a webhook endpoint in Dodo pointing to `https://your-app.example.com/api/webhooks/dodo`, subscribe it to the subscription events, and copy the signing secret into `DODO_PAYMENTS_WEBHOOK_KEY`.
4. Complete a test-mode checkout end-to-end, including the webhook relay or a public tunnel, before enabling live mode.
5. For production, create separate live products, set the `_LIVE` ids, switch `DODO_PAYMENTS_ENVIRONMENT=live_mode`, and use the live API key and live webhook secret.

Keep the test and live values in different environments. Do not reuse test product ids with live credentials, and do not enable live mode until the checkout, webhook, renewal, cancellation, and portal flows have been verified in test mode.

### 4. Python processor

Build and run the container:

```bash
docker build -t flowparse-processor services/processor
docker run --env-file services/processor/.env -p 8000:8000 flowparse-processor
```

Deploy the image to a long-running container host (Fly.io, Render, Railway, ECS, etc.). Requirements:

- Outbound HTTPS to Supabase.
- Enough memory for OCR page rendering; OCR jobs are CPU- and memory-heavy.
- A health check against `/health`.
- `PROCESSOR_API_KEY` matching the Next.js environment.
- `SUPABASE_SERVICE_ROLE_KEY` supplied as a secret.
- `OCR_ENABLED=true` and no `TESSERACT_CMD` override in the container (Tesseract is installed in the image).
- Do not expose the processor publicly without network restrictions or a private service link. The shared secret is a service credential, not a user credential.

Serverless functions are not a good fit for the processor because OCR can exceed request time limits and needs a warm Tesseract installation.

### 5. Post-deploy smoke test

1. Create an account and upload one digital and one scanned statement.
2. Confirm processing reaches a terminal state and the reconciliation values look correct.
3. Edit a row, save, reload, and export both formats.
4. Test password recovery from a real email inbox.
5. Sign in as a second user and verify complete data isolation.
6. Run one test-mode checkout and confirm the webhook activates the plan; then cancel it and confirm access ends at the period end.
7. Check logs for failed extraction, billing webhook signature failures, or processor credential errors.

---

## Known limitations and production hardening

This is an MVP with deliberate scope boundaries:

- **Heuristic extraction.** The parser is layout-aware and now uses declarative bank profiles, but it is not bank-universal. Statement layouts it does not recognize produce partial results, flagged rows, or a failed extraction with an explanation. Unresolved lines are listed in the extraction report rather than invented. Expand the synthetic fixture corpus before claiming broad bank coverage, and follow [`docs/adding-a-bank.md`](docs/adding-a-bank.md) for bank-specific conventions.
- **In-process job queue.** Jobs run in a thread pool inside the FastAPI process. Interrupted jobs are recovered as failed at processor startup, but there is no durable broker or automatic retry. Use a queue such as SQS/Redis and idempotent workers for higher scale.
- **Best-effort monthly quota.** The allowance is checked before insertion. Two simultaneous uploads at the limit could exceed it by one. Move the check and insert into a single transactional RPC if strict enforcement is required.
- **Billing is monthly-plan only.** Plan changes, proration, and mid-cycle upgrades are handled in the Dodo customer portal rather than an in-app comparison flow. Page allowances reset on the calendar month, not on the subscription anniversary, so a mid-month subscription starts with a fresh allowance.
- **Webhook recovery relies on Dodo retries.** A failed webhook returns `5xx` so Dodo redelivers, and processed ids make redelivery safe, but there is no local replay queue. Events that cannot be mapped to a FlowParse user are acknowledged and logged instead of guessed, so a customer created outside the checkout flow needs its `app_user_id` metadata or a linked customer row.
- **No malware scanning.** PDFs are validated structurally by the parser and stored privately, but they are not virus-scanned. Add object scanning/quarantine before processing untrusted files at scale.
- **Storage cleanup is best-effort.** Deleting a statement removes the database row and attempts to remove the object. If storage deletion fails, the object remains private and unreachable; add a lifecycle job to remove orphans.
- **Retention and deletion policy.** There is no automated retention schedule or self-service account deletion yet. Define these before handling regulated financial data.
- **OCR language coverage.** English is the default and only packaged model. Install additional Tesseract language data and expose the setting if needed.
- **Polling, not realtime.** The workspace polls the authenticated API. This is simple and reliable for the MVP but not as efficient as Supabase Realtime or server-sent events at scale.
- **No MFA, team workspaces, audit log, or granular roles.** The data model is per-user and single-tenant by design.
- **Processor availability.** If the processor is down, statements stay queued and the UI reports the problem; manual data entry and exports of existing statements still work.
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
