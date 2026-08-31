# Secrets & environment configuration

This project has two separate env surfaces — keep them separate, never cross-populate:

1. **Frontend** (`strata/.env.local`) — only ever the Supabase **anon** key. Safe to ship to the browser.
2. **Edge Functions** (Supabase secrets store) — Anthropic + embedding provider keys, and the
   Supabase **service_role** key. Never referenced from frontend code.

---

## 1. Frontend env — `strata/.env.local`

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321        # or your cloud project URL
VITE_SUPABASE_ANON_KEY=...                       # anon/public key only
```

Get these from:
- **Local dev**: printed by `supabase start` (or `supabase status`) in your terminal running the local stack.
- **Cloud**: Supabase Dashboard → Project Settings → API → Project URL / anon public key.

`strata/.env.example` (committed, no real values) mirrors this file — copy it to `.env.local` and fill in.

---

## 2. Edge Function secrets

Edge Functions run in a separate runtime and read secrets via `Deno.env.get(...)`. Two ways to set them:

### Local development
Create `supabase/functions/.env` (gitignored) from `supabase/functions/.env.example`:
```bash
HF_TOKEN=hf_...            # Hugging Face token — used by extract-and-structure (Qwen2.5-VL)
ANTHROPIC_API_KEY=sk-ant-...   # used by query-router's classify step only
EMBEDDING_API_KEY=...       # Voyage AI key (voyageai.com) — or swap embeddings.ts for OpenAI
```
The local CLI (`supabase functions serve`) loads this file automatically.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for local functions — no action needed.

### Cloud (hosted) deployment
Secrets must be set once via the CLI before deploying — they are stored server-side, not read from a file:
```bash
supabase link --project-ref <your-project-ref>

supabase secrets set HF_TOKEN=hf_...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set EMBEDDING_API_KEY=...

supabase functions deploy extract-and-structure
supabase functions deploy query-router
```
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected for hosted functions too.

---

## 3. Where each key comes from

| Variable | Where to get it | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → Settings → API, or local `supabase status` | Frontend |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API, or local `supabase status` | Frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API (auto-injected for Edge Functions) | Edge Functions only |
| `HF_TOKEN` | huggingface.co/settings/tokens | `extract-and-structure` (Qwen2.5-VL) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | `query-router` (classify step) |
| `EMBEDDING_API_KEY` | voyageai.com (or OpenAI platform if you swap providers) | Both Edge Functions |
| `SUPABASE_ACCESS_TOKEN` | Supabase account → Access Tokens (CLI login: `supabase login`) | CLI only, not runtime |
| `SUPABASE_PROJECT_REF` | Project URL or Settings → General | CLI `link`/`deploy` only |

## 4. pgvector extension

Enable once per project — no key required:
- **Local**: already enabled by the `create extension if not exists vector;` line in
  `supabase/migrations/20260830000000_init_schema.sql`.
- **Cloud**: Dashboard → Database → Extensions → search "vector" → enable. Not required if you
  always run migrations against the cloud project too (the migration does it for you).

## 5. Never commit

`.gitignore` at the project root excludes: `.env`, `.env.local`, `supabase/functions/.env`,
and any `*.env` variant. Only `*.env.example` files are committed.
