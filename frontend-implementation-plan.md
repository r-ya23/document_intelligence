# Strata — Frontend Implementation Plan

Scope: this plan treats the two Edge Functions (`extract-and-structure`, `query-router`) as a fixed API
contract — defined once, stubbed early, built against for the rest of the project. Everything else is
frontend engineering: data flow, state, UI, and the review/edit UX that is the actual product value here.

Sequencing principle: ship a vertical slice at the end of every phase (something running end-to-end in
the browser), not a horizontal layer. Never spend a full day on UI with no data behind it or vice versa.

---

## Phase 0 — Contracts before code (~1-2 hrs)

Before writing any component, freeze three things in writing, because every screen after this depends on them:

1. **DB schema** — from the plan, as-is. Create it in Supabase now (SQL editor, run the migration once).
2. **Edge Function I/O contract** — request/response shape for both functions, e.g.:
   ```ts
   // POST /extract-and-structure
   { document_id: string } →
   { status: "ready_for_review" | "failed", fields?: Field[], error?: string }

   // POST /query-router
   { query: string } →
   { mode: "filter" | "semantic", results: DocumentRow[] | FieldMatch[] }
   ```
3. **TypeScript types** generated from the schema, not hand-written — use `supabase gen types typescript`
   so the frontend types can never silently drift from the DB.

Deliverable: `src/types/db.ts` (generated), `src/types/api.ts` (hand-written contract above), schema live in Supabase.

**Why this order matters for a frontend role**: reviewers are checking whether you build against a contract
or against vibes. Freezing types first means every subsequent phase is a known shape, not a guess.

---

## Phase 1 — Skeleton + data flow (Day 1)

Goal: empty states rendering with real Supabase data, no extraction logic yet.

- Scaffold: Vite + React + TS + Tailwind + shadcn (commands as in the original plan — no changes needed there).
- Supabase client singleton (`src/lib/supabase.ts`), `.env.local` with anon key only.
- React Query provider at root. Every Supabase read/write goes through a query/mutation hook — no `useEffect` + `fetch` scattered in components. This is the one architectural decision that keeps Day 3 (editing + audit log) from becoming a mess.
- Routes: `/` (upload + document list), `/documents/:id` (review screen), `/query` (query bar).
- Upload flow: file → Storage bucket → insert `documents` row → row appears in list via **Realtime subscription** (not polling, not refetch-on-mount — the plan explicitly calls for Realtime, wire it now while the list is still simple).

Deliverable: drop a file in, see it appear in a list with `status: queued`, refresh not required.

Skip for now: Edge Functions. Stub `status` transitions manually in the DB to build the UI against, so frontend work isn't blocked on backend/prompt iteration.

---

## Phase 2 — Structure review screen (Day 2)

This is the highest-value UI in the product — prioritize it over polish elsewhere.

- Split-pane layout: source document (image/PDF render or plain text) on one side, extracted `fields` list on the other.
- **Field ↔ source-span linking**: hovering a field highlights its `source_span` in the source pane. Implementation approach:
  - If source is plain text: locate `source_span` via string search in `raw_text`, wrap in a `<mark>` with a ref, scroll into view on hover.
  - If source is an image/PDF: source_span highlighting is a stretch goal — plain-text documents are the safe default path; don't burn Day 2 on PDF coordinate mapping unless the text path is done early.
- Confidence badges: `high` vs `review` rendered as a visual tag (color + icon, not color alone — accessibility), sorted so `review` fields surface to the top of the list.
- Trigger extraction from the UI: button calls `extract-and-structure`, optimistic status update to `extracting`, Realtime pushes the real transition through.

Deliverable: upload → trigger extraction → see fields rendered against source text with confidence badges.

---

## Phase 3 — Verification loop (Day 3)

- Inline editing on each field (click to edit, shadcn `Input` + save/cancel, not a separate edit mode for the whole page).
- On save: update `fields.value`, insert `audit_log` row (`old_value`/`new_value`) in the same mutation — use a Postgres function or two sequential calls wrapped in a React Query mutation with rollback on failure, not two independent fire-and-forget calls.
- `verified` flag: a field can only flip to `verified: true` once edited/confirmed; document-level `status: 'verified'` derives from "all fields verified" — compute this client-side or via a DB view, don't duplicate the rule in two places.
- Audit trail view: per-document timeline, old → new, timestamp. Read-only, simple table is enough — this is a compliance/trust feature, not a place to over-design.

Deliverable: edit a field, see audit entry appear, verified badge updates the document status.

---

## Phase 4 — Query (Day 4)

- Query bar (single input, natural language) → calls `query-router`.
- Results view: **table/JSON toggle** as the plan specifies — table for structured filter results (columns = field labels), raw JSON for semantic search results (similarity matches don't map cleanly to a table).
- Show which mode was used (`filter` vs `semantic`) in the UI — this is useful debug/trust signal for the reviewer watching you demo it, not just internal logic.
- Empty/no-match state distinct from loading state.

Deliverable: type a natural-language question, get back either filtered rows or semantic matches, visibly labeled.

---

## Phase 5 — Polish + ship (Day 5)

- Error states: failed extraction (show the error, allow retry), unsupported file type (reject at upload, not after a round-trip to the Edge Function).
- Loading/skeleton states for every async boundary already built — don't add new ones now, just fill gaps.
- Deploy frontend (Vercel), confirm env vars set, confirm Edge Functions reachable from the deployed origin (CORS).
- `decisions.md`: write the three tradeoffs already listed in the original plan (self-reported confidence, open RLS, no job queue) — plus any new one that came up in practice (e.g. PDF highlight limitation from Phase 2 if you scoped it out).

---

## What NOT to do (senior-level scope discipline)

- Don't build the Edge Functions and the frontend in lockstep — define the contract, stub responses, build UI against the stub, swap in the real function when ready. Otherwise frontend work stalls on prompt-engineering iteration.
- Don't hand-roll auth/multi-tenancy — the plan explicitly scopes RLS to open (`using (true)`); respect that scope, don't gold-plate.
- Don't build a generic "form renderer" for fields before you have 2-3 real documents' worth of field shapes to generalize from. Premature abstraction here costs a day.
- Don't attempt PDF-coordinate source-span highlighting unless the plain-text path is fully done with time to spare — this is the one place effort can silently balloon past its value.

---

## Definition of done per phase

Each phase above ends in something you can literally click through and demo — that's the check, not
"component exists" or "function deployed." If a phase doesn't produce a clickable increment, it isn't done.
