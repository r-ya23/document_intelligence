# Strata — AI Document Intelligence

Strata turns unstructured business documents (invoices, contracts, resumes, scans) into structured, queryable data using multi-modal AI, schema-driven containers, human verification, and vector-based semantic search.

---

## What makes it different: schema-driven containers

A **container** is a *typed dataset*, not just a folder. When you create one, you can define its field schema — e.g. an invoices container with `vendor` (text), `total_due` (currency), `due_date` (date). Every document added to that container is extracted **against that schema**, so labels and types stay consistent across the whole set.

That consistency is what makes the rest work:

- **Structured filters** are reliable, because `total_due` means the same thing on every document.
- **Semantic search** can be scoped to one container (its own domain) or run globally across all datasets, with provenance showing which container each hit came from.
- The schema is **optional** — leave it empty and extraction falls back to open-ended, letting the model choose the labels.

---

## Key features

- **Schema-driven extraction**: extraction targets the container's defined fields; fields found outside the schema are captured and flagged as "additional" rather than dropped. Missing required fields are surfaced for review.
- **Multi-modal AI**:
  - Mistral OCR (`mistral-ocr-latest`) reads PDFs/images and returns structured fields in one call via `document_annotation_format`.
  - Plain-text files (`.txt/.md/.csv/.json`) are structured via Mistral chat (`mistral-small-latest`).
  - Each field carries a self-reported confidence (`high` / `review`) and a source-text span for highlighting.
- **4-step extraction wizard**: Upload → Extract → Verify → Publish. Auto mode verifies all fields and advances; manual mode stops for review. Status updates live via Supabase Realtime.
- **Verification loop**: inline field editing, source-text highlighting, per-field confidence, and an audit trail (old → new value).
- **Query engine (scoped + global)**: natural-language queries are classified into a structured `filter` (predicates over `fields`) or `semantic` (pgvector cosine similarity over document embeddings). Both accept an optional `container_id`.
- **Clean failure handling**: a failed extraction fails the whole document — partial fields are removed, the document is marked `failed` with the error shown in the UI, and the uploaded file is kept in Storage for debugging/retry.
- **UI**: reusable paginated tables (`DataTable`), searchable document list, dashboard with "view more/less" cards and stat cards, sticky collapsible sidebar + header, light/dark mode.

---

## Tech stack

**Frontend (`/strata`)**
- React 19, TypeScript, Vite
- Tailwind CSS v4, Radix UI primitives, Lucide icons
- TanStack React Query v5, React Router v6
- Sonner toasts

**Backend (`/supabase`)**
- PostgreSQL with `pgvector`
- Supabase Storage (document files)
- Deno Edge Functions: `extract-and-structure`, `query-router`
- Mistral AI (OCR + chat) for extraction; Voyage AI (`voyage-3`, 1024-dim) for embeddings

---

## Data model

| Table | Purpose |
|---|---|
| `containers` | A dataset: name, doc_type, default verify mode |
| `container_fields` | The container's field schema (label, type, required, description) |
| `documents` | Uploaded file + status + `container_id` + `embedding` (`vector(1024)`) |
| `fields` | Extracted key/value pairs (+ confidence, verified, field_type, is_schema_field, source_span) |
| `audit_log` | History of field corrections (old → new) |

Key RPCs:
- `match_documents(query_embedding, match_threshold, match_count, filter_container_id)` — semantic search, optionally scoped to a container, returns provenance.
- `container_field_aggregate(container_id, label, agg)` — numeric rollups (`sum/avg/count/min/max`) over a container's fields.

---

## Project structure

```text
document_intelligence/
├── README.md
├── decisions.md                    # Architectural tradeoffs and what a prod version would change
├── strata/                         # React + Vite frontend
│   └── src/
│       ├── components/             # UI, containers, wizard, shared DataTable
│       ├── features/containers/    # container view models + Supabase-backed hooks
│       ├── hooks/                  # document/extraction/query hooks
│       ├── lib/                    # supabase client, edge-function invokers, theme
│       ├── pages/                  # dashboard, container detail, wizard, documents, query
│       └── types/                  # db.ts (schema types), api.ts (edge fn contracts)
└── supabase/
    ├── functions/
    │   ├── _shared/                # CORS, admin client, embeddings
    │   ├── extract-and-structure/  # schema-driven OCR + structuring pipeline
    │   └── query-router/           # filter vs semantic query routing
    └── migrations/                 # schema, storage, pgvector, containers, search RPCs
```

---

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ (the `shadcn` CLI requires Node 20+; the rest works on 18)
- [Docker Desktop](https://www.docker.com/) (for the local Supabase stack)
- [Supabase CLI](https://supabase.com/docs/guides/cli) — via `npx supabase ...`, Scoop, or Homebrew (not `npm i -g`)

### 1. Install frontend deps
```bash
cd strata
npm install
```

### 2. Environment variables

**`strata/.env.local`** (copy from `.env.example`):
```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your_local_anon_key
```

**`supabase/functions/.env`** (copy from `.env.example`):
```bash
MISTRAL_API_KEY=your_mistral_api_key
EMBEDDING_API_KEY=your_voyage_ai_api_key   # must be a Voyage AI key, not a MongoDB Atlas key
```

### 3. Start Supabase (applies all migrations)
```bash
# from the repo root
supabase start
```
If you add migrations after the DB already exists, apply them with `supabase migration up` (or rebuild with `supabase db reset`).

### 4. Serve edge functions
```bash
supabase functions serve --env-file ./supabase/functions/.env
```
Restart this process after changing function code or env — it doesn't always hot-reload.

### 5. Start the frontend
```bash
cd strata
npm run dev
```
Open `http://localhost:5173`.

---

## Scripts (from `strata/`)

```bash
npm run dev       # dev server
npm run build     # tsc -b + vite build
npm run preview   # preview the production build
npm run lint      # eslint
npm run test      # vitest (UI tests)
```

---

## Notes & known limitations

See [`decisions.md`](./decisions.md) for the full list. In brief:
- Confidence is self-reported by the model, not a calibrated probability.
- Row-Level Security is open (single-user assignment scope); a real product would scope by `auth.uid()`.
- Extraction runs synchronously in the edge function (no job queue), so very large documents can hit the function timeout.
- Semantic search requires embeddings — a document only appears in semantic results once its Voyage embedding succeeded.
