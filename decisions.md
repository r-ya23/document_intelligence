# decisions.md

Tradeoffs made in Strata, why, and what a production version would do differently. Written
against the actual implementation, not the plan in the abstract — includes things discovered
while building, not just what was anticipated upfront.

---

## 1. Confidence is self-reported, not measured

`fields.confidence` (`high` | `review`) comes from asking Claude to self-assess via the tool-use
schema (`record_extracted_fields`). This is **not** a real token-level confidence score — the
Anthropic API doesn't expose logprobs for tool-use calls the way some completion APIs do.

The model is asked to say how sure it is, and we display that verbatim. It's a real limitation:
a model can be confidently wrong, and this pipeline has no independent way to catch that. It's
directionally useful (it does surface genuinely ambiguous extractions, like handwritten dates or
smudged totals) but should not be read as a calibrated probability.

**With more time**: cross-check extracted values against a second, independent signal —
e.g. regex/format validation for dates and currency, or a second cheaper model call
specifically to verify rather than extract. Disagreement between the two would be a much
stronger confidence signal than self-report alone.

---

## 2.  (Row Level Security) is fully open

Every table (`documents`, `fields`, `audit_log`) and `storage.objects` has RLS enabled with
`using (true) with check (true)` — any anon-key holder can read/write everything. This is correct
for the assignment's scope (single-user, no auth) but is explicitly **not** how this would ship.

A real product would add:
- `auth.uid()`-scoped policies once user accounts exist, so documents belong to a user/org
- Storage policies scoped to `auth.uid()` matching a path prefix, not `bucket_id = 'documents'` alone
- The two Edge Functions already use the `service_role` key (bypasses RLS) precisely because they
  need write access regardless of who's calling — that boundary doesn't change with auth added

One thing found during implementation, not anticipated: `storage.buckets` itself has RLS enabled
by default with **no** policy added (only `storage.objects` got policies). This means the anon key
can upload/download/delete objects fine but can't `GET` bucket metadata — a 404 on
`/storage/v1/bucket/documents` even though the bucket exists. Functionally harmless here (the
frontend never reads bucket metadata), but worth naming: an easy gap to leave unnoticed since it
doesn't break anything visible.

---

## 3. No background job queue

`extract-and-structure` runs synchronously inside the Edge Function invocation — upload triggers a
direct call, the function does the Claude call + embedding call + DB writes in one request, and
Realtime pushes the resulting status change to the frontend. No `pgmq`, no worker process.

This is fine at this scale and keeps the architecture simple (no extra infra to run), but has a
real ceiling: **Edge Functions have a timeout** (Supabase's default is short, minutes not hours). A
very large scanned document, a slow Claude response, or a large embedding batch could hit that
ceiling and fail the whole extraction with no partial progress saved.

**With more time**: move extraction to a queue (`pgmq` is the natural fit since it's already
Postgres-native, no new infra) with a worker that can retry, checkpoint partial progress (e.g. save
`raw_text` and `doc_type` before attempting fields, so a failure after Claude succeeds doesn't lose
that work), and process files well past the current Edge Function ceiling.

---

## 4. Source-span highlighting is plain-text only

`source-text-pane.tsx` highlights a field's `source_span` via a literal string search
(`indexOf`) against `raw_text`, wrapped in `<mark>`. This works well for text-based documents
(`.txt`, `.md`, `.csv`, `.json`) where `raw_text` is the actual document content.

**Image-based documents have no highlighting at all right now.** When a scan is sent to Claude as
an image content block, there's no `raw_text` extracted from it (the field values come back but
there's no OCR'd text layer to search against for coordinates), so `SourceTextPane` shows "No
source text available" for those. This was flagged as a risk in the implementation plan
(coordinate-mapping highlights for images/PDFs "can silently eat a day") and the scope call was:
build the plain-text path solidly, leave image highlighting as a known gap rather than attempting
a half-working bounding-box overlay.

**With more time**: run image documents through a real OCR step first (or ask Claude for
approximate bounding boxes alongside `source_span` in the tool schema) to get a text layer +
coordinates to highlight against.

---

## 5. PDF is not supported yet

The plan called for "text-lib path (pdf-parse/mammoth) + Claude vision fallback" for PDFs.
`extract-and-structure/index.ts` currently throws an explicit, named error
(`"PDF extraction requires a text-extraction step not yet implemented..."`) rather than silently
mis-handling PDFs — this was a deliberate choice to fail loudly and specifically rather than let a
PDF upload produce a confusing downstream error.

Only `.txt`, `.md`, `.csv`, `.json`, and common image formats (`.png`, `.jpg`, `.webp`, `.gif`) are
accepted at upload (enforced client-side before any network call, and again server-side in the
Edge Function as defense-in-depth).

**With more time**: add a PDF text-extraction step (e.g. `pdf-parse` in Deno, or render pages to
images and use the same vision path already built for scans) — the tool-use extraction and DB
write logic downstream is already format-agnostic, so this is additive, not a rework.

---

## 6. Field edit + audit log write is not atomic

`useUpdateField` does two sequential writes: update `fields.value` (+ `verified = true`), then
insert into `audit_log`. There's no Postgres function wrapping both in a transaction. If the first
succeeds and the second fails, the field value is updated but the correction isn't recorded in the
audit trail — a real (if narrow) consistency gap for a feature whose entire purpose is
traceability.

This was a deliberate scope call for the assignment size rather than an oversight: writing a
Postgres RPC function to wrap both statements is a known, standard fix, just not done here.

**With more time**: wrap both writes in a single `plpgsql` function called via `.rpc()`, so the
audit entry and the value change succeed or fail together.

---

## 7. Environment / tooling notes (not a product tradeoff, but relevant)

- Local development requires Node ≥20 for the `shadcn` CLI specifically (uses a Node 20+ web
  API); the rest of the toolchain works on Node 18. Documented in case this trips up setup on a
  machine with an older Node default.
- `supabase functions serve` requires Docker socket access; `supabase db push`/`db reset` only
  need network access to the already-running Postgres port. On a machine where the shell running
  Supabase CLI commands isn't in the `docker` group, migrations can still be applied, but Edge
  Functions can't be served locally — deploying to a real Supabase project sidesteps this since
  hosted functions don't depend on the local Docker daemon.

---

## What's fully verified vs. not

Everything in the frontend (upload, Realtime list, structure review, inline edit + audit log +
verified-status derivation, query bar UI + both result view modes, error/loading states across
every async boundary) was verified against a **real running local Supabase instance** via
browser-level testing, not just code review — including one real bug caught this way (a
rules-of-hooks violation that `tsc`/eslint didn't catch, only a real render did).

**Not verified end-to-end**: the actual Claude tool-use extraction call and the embedding call
inside the two Edge Functions. `supabase functions serve` could not run in the environment this
was built in (Docker access unavailable), so the functions' request/response *contracts* were
verified (via mocked responses matching their exact code paths) but the real Anthropic/Voyage API
calls inside them were never exercised. Running `supabase functions serve` with real
`ANTHROPIC_API_KEY`/`EMBEDDING_API_KEY` values set is the remaining step to close that gap.
