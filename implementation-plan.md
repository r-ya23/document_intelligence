# Strata — implementation plan

Turning unstructured/semi-structured documents into structured, queryable data.

## 1. Stack decision

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui | Fast dev loop, no framework overhead you don't need |
| Backend | Supabase (Postgres + Storage + Auth + Edge Functions + Realtime) | One managed product covers DB, files, auth, and the two server-side functions — no separate server to run |
| LLM | Claude (Anthropic API), Sonnet | Multimodal (reads scans directly, no OCR step) + tool-use for schema-enforced JSON |
| Embeddings | Voyage AI `voyage-3` or OpenAI `text-embedding-3-small` | One-line API call, used only for the semantic-search path |
| Vector search | `pgvector` extension inside the same Postgres | No separate vector DB — one less product to run/pay for |
| Hosting | Vercel or Netlify (frontend) + Supabase (backend) | Both deploy from git, both have generous free tiers |

**Why not a separate backend (Express/FastAPI):** the only things that must never run in the browser are calls that use a secret API key — Claude extraction and embeddings. Everything else (file upload, reading/writing structured fields, logging corrections) goes straight from the browser to Supabase via its client SDK + row-level security. So "backend" here means **two small Edge Functions**, not a server you provision and run yourself.

**Why not a separate vector DB (Pinecone/Weaviate/Qdrant):** `pgvector` lives in the same Postgres instance as your structured data. For an assignment at this scale, spinning up a second database just for vectors adds ops overhead with no real benefit — and most of your queries (the ones with real business value) are structured filters anyway, not semantic search.

---

## 2. Product setup

### 2.1 Supabase project
```
1. supabase.com → New project → note the project URL + anon key
2. Enable extension: Database → Extensions → pgvector
3. Create a storage bucket: `documents` (private, not public)
4. Settings → API → copy the service_role key (used only inside Edge Functions, never in frontend code)
```

### 2.2 Database schema
```sql
create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null,
  doc_type text,                          -- 'invoice' | 'contract' | 'resume' | null (unknown)
  status text not null default 'queued',  -- queued | extracting | structuring | ready_for_review | verified | failed
  raw_text text,                          -- extracted plain text, used for embeddings
  embedding vector(1024),                 -- pgvector column, dims match your embedding model
  created_at timestamptz default now()
);

create table fields (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  label text not null,                    -- e.g. 'total_due'
  value text,
  source_span text,                       -- raw text span the value was read from, for the highlight UI
  confidence text default 'high',         -- 'high' | 'review'
  verified boolean default false,
  created_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  field_id uuid references fields(id) on delete cascade,
  old_value text,
  new_value text,
  edited_at timestamptz default now()
);

-- vector similarity index (build after you have some rows, or use ivfflat with lists tuned later)
create index on documents using ivfflat (embedding vector_cosine_ops);

-- row-level security: open read/write for now, tighten if you add auth
alter table documents enable row level security;
alter table fields enable row level security;
alter table audit_log enable row level security;
create policy "allow all" on documents for all using (true) with check (true);
create policy "allow all" on fields for all using (true) with check (true);
create policy "allow all" on audit_log for all using (true) with check (true);
```

### 2.3 Edge Functions (the only server-side code)
```
supabase functions new extract-and-structure
supabase functions new query-router

# secrets, set once
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set EMBEDDING_API_KEY=...

supabase functions deploy extract-and-structure
supabase functions deploy query-router
```

### 2.4 Frontend setup
```
npm create vite@latest strata -- --template react-ts
cd strata
npm install @supabase/supabase-js @tanstack/react-query
npx shadcn@latest init
npm install tailwindcss @tailwindcss/vite
```
`.env.local`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...   # anon key only — never the service_role key in frontend code
```

---

## 3. Claude tool-use schema (inside `extract-and-structure`)

```js
const tools = [{
  name: "record_extracted_fields",
  description: "Return the structured fields read from this document.",
  input_schema: {
    type: "object",
    properties: {
      doc_type: { type: "string", enum: ["invoice", "contract", "resume", "other"] },
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            source_span: { type: "string", description: "exact text this value was read from" },
            confidence: { type: "string", enum: ["high", "review"] }
          },
          required: ["label", "value", "confidence"]
        }
      }
    },
    required: ["doc_type", "fields"]
  }
}];

// scanned doc → send as image content block; native PDF/docx → send extracted text
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  tools,
  tool_choice: { type: "tool", name: "record_extracted_fields" },
  messages: [{ role: "user", content: [ /* image or text block */ ] }]
});
```

Edge function then: writes `fields` rows, sets `document.raw_text`, calls the embedding API, writes `document.embedding`, sets `status = 'ready_for_review'`.

---

## 4. Query router (inside `query-router`)

```js
// step 1 — classify: does this need a structured filter or semantic search?
const classify = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  tools: [{
    name: "route_query",
    input_schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["filter", "semantic"] },
        filters: { type: "array", items: {
          type: "object",
          properties: { field: {type:"string"}, op: {type:"string"}, value: {type:"string"} }
        }}
      },
      required: ["mode"]
    }
  }],
  tool_choice: { type: "tool", name: "route_query" },
  messages: [{ role: "user", content: nlQuery }]
});

// step 2a — filter mode: translate to a Postgres query over `fields`
// step 2b — semantic mode: embed nlQuery, run `match_documents` via pgvector cosine distance
```

---

## 5. Day-by-day build

**Day 1 — foundations**
- Supabase project, schema, storage bucket, RLS policies
- Vite app scaffolded, Supabase client wired
- Upload UI → storage → `documents` row insert, realtime status subscription

**Day 2 — extraction + structuring**
- `extract-and-structure` Edge Function: text-lib path (pdf-parse/mammoth) + Claude vision fallback
- Tool-use call → `fields` rows written
- Structure review screen: split pane, field ↔ source-span hover highlight

**Day 3 — verification loop**
- Inline field editing → write to `fields` + `audit_log`
- Audit trail view (old value → new value, timestamped)
- Confidence badges driving which fields need review before "verified"

**Day 4 — query**
- `query-router` Edge Function (filter vs. semantic)
- Query bar UI + results view (table/JSON toggle)

**Day 5 — polish + ship**
- Empty states, error states (failed extraction, unsupported file type)
- Deploy frontend (Vercel/Netlify), confirm Edge Functions live
- Write `decisions.md`: what got cut, why pgvector is scoped to semantic-only, confidence-scoring limitation, what you'd do with more time

---

## 6. What to explicitly flag as a tradeoff in `decisions.md`

- No real token-level confidence from the API — using self-reported confidence from the model instead, and naming that limitation directly rather than hiding it.
- RLS is fully open (`using (true)`) for the assignment's scope — call out that a real product would gate this by user/org.
- No background job queue — status is updated via the Edge Function directly and pushed over Supabase Realtime, which is fine at this scale but wouldn't survive a function timeout on a very large file; a queue (e.g. `pgmq` or a proper worker) is the next step.
