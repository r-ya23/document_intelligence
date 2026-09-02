# decisions.md

This is the running log of the calls I made building Strata's frontend — the ones I actually
stopped and thought about, not every line I wrote. It leans frontend because that's where most of
the product lives: the extraction pipeline is two edge functions I treat as a fixed API, and almost
everything a reviewer touches is React. I've tried to be honest about the stuff I'd redo, the bugs
that changed my mind mid-build, and the things I chose to leave alone.

---

## Every read/write goes through a React Query hook

Early on I made one rule for myself: no `useEffect` + `fetch` scattered around components. Every
Supabase call lives in a hook — `useDocuments`, `useDocument`, `useUpdateField`,
`useCreateContainer`, `useRunQuery`, and so on. Components ask for data; they don't fetch it.

I considered the looser approach (fetch where you need it) because it's faster for the first screen.
But this app is basically a chain of async boundaries — upload, extract, review, edit, audit,
query — and the moment editing + audit logging showed up, ad-hoc fetching would've turned into a
mess of stale state and manual refetches. Centralizing on React Query meant caching,
invalidation, and loading/error states came for free and behaved the same everywhere.

What I left out: I didn't reach for optimistic updates most places. Realtime already pushes the
truth back fast enough that the extra complexity (and rollback code) wasn't worth it for a
single-user app.

---

## Realtime for status, not polling

Document status moves through a few states (`queued → extracting → structuring → ready_for_review`),
and I wanted the UI to reflect that live without the user refreshing. `useDocuments` /
`useDocument` subscribe to Postgres changes and invalidate the relevant query on any change.

Polling would've been simpler to reason about, but it's either laggy (long interval) or wasteful
(short interval), and the wizard's "watch it extract" moment really wants to feel live. Realtime
was already in the box with Supabase, so wiring it was cheap. The tradeoff is subscriptions are a
little harder to reason about than a timer — but the payoff (the extract step updating itself, the
document list reordering as things finish) is exactly the part of the demo that feels alive.

---

## The review screen is the product, so it got the most care

The split-pane review screen — fields on one side, source text on the other, hover a field to
highlight where it came from — is where the actual value is. Anyone can call an LLM; the trust
comes from a human being able to check and fix what it pulled. So I spent my time here rather than
polishing peripheral screens.

Two concrete calls inside it:

- **Source-span highlighting is plain-text only.** For text documents I find the field's
  `source_span` in the raw text and wrap it in a highlight. For images/PDFs there's no text layer to
  search against, so those just don't highlight. I deliberately didn't attempt bounding-box overlays
  on images — that's the classic thing that quietly eats a day for a half-working result. Plain-text
  path solid, image path honestly absent, beats both half-done.
- **Inline edit, not an edit mode.** Click a value, edit it in place, save or cancel. No separate
  "edit this document" screen. It keeps the reviewer in flow, which is the whole point of the screen.

---

## Confidence sorting stays — but I want to be honest about what it means

Fields carry a `high` / `review` confidence, and `sortByConfidence` floats the `review` ones to the
top of the list so the stuff that needs attention isn't buried.

Here's the honest part. The confidence comes from two places: the model self-reporting (we're on
Mistral now, not the Claude tool-use I originally planned), and one hard rule I added — a missing
*required* field is forced to `review` no matter what the model says. The self-reported half is
weak; a small model saying "I'm confident" isn't a calibrated probability and can be confidently
wrong. I thought about ripping the whole thing out because of that. I kept it because the
*required-field rule* genuinely earns the sort — it reliably surfaces fields the model failed to
find, which is exactly what a reviewer should see first. So the sort survives on the strength of the
deterministic rule, not the model's self-assessment.

What I'd do with more time: back confidence with a real second signal — format-validate the value
against its `field_type` (does the "currency" field parse as money, does the "date" parse as a
date) and treat a mismatch as low confidence regardless of what the model claimed. The `field_type`
column is already there for it; I just didn't build the validators.

---

## Containers as typed datasets, and the schema builder in the create dialog

A container isn't a folder — it's a dataset with a field schema you define up front (label, type,
required). When you create "Vendor invoices" you say you want `vendor`, `total_due` (currency),
`due_date` (date), and every document you drop in gets extracted against *that* shape.

On the frontend this meant the create dialog isn't just a name field — it's a little schema builder
(add/remove rows, pick a type, toggle required), seeded with sensible starter fields per doc type so
it's not a blank slate. I made the schema **optional** on purpose: leave it empty and extraction
falls back to letting the model choose labels. That keeps the "just throw a document in" path open
while rewarding people who define structure.

I deliberately didn't build schema editing-after-the-fact, versioning, or per-field validation
rules. Those matter once real data exists in a container and the schema needs to change under it —
but that's a later problem, and guessing at it now would've been premature.

Worth flagging: for a good while containers were pure in-memory mock state that reset on reload. I
knew that was a gap and called it out; moving them to real Supabase tables (and wiring the dialog to
actually insert) was the change that made the whole USP real instead of a UI demo.

---

## One shared, self-paginating table instead of three

There are three tables in the app — the document list and the two query-result views (filter and
semantic). I'd hand-rolled pagination into the document list first, then found myself about to do it
again for query results. That's when I stopped and pulled it into one `DataTable<T>`: you hand it
columns and data, it owns paging, empty state, row clicks, and the "1–10 of N" pager.

I chose client-side pagination (slice the already-fetched list) over server-side ranging. The lists
are Realtime-subscribed and small, so slicing in memory means new uploads still land on the right
page with zero extra query plumbing. I also skipped a table library like TanStack Table — these are
two-to-four-column tables; a library would've been more API surface than the job needs.

The honest ceiling: this doesn't scale to thousands of rows. When it needs to, the move is
server-side `.range()` plus reconciling Realtime with paged queries — and that's the moment to reach
for a real table library too. Not today.

---

## Search and pagination are in-memory, and that's a deliberate scope line

The document list has a search box (name or type) and the query results paginate. Both filter/slice
the full fetched set client-side rather than pushing the work to the database.

It's the same reasoning as the table: the data's already here and it's small. Doing it in the
browser is instant and keeps the code simple. If the corpus grew, search would move to a Postgres
`ilike`/full-text query and pagination to server ranging — but wiring that now would be solving a
scale problem I don't have.

---

## Failure has to *look* like failure

A real bug taught me this one. The extractions log was hardcoding every document's status as
"published," so a document whose extraction had actually failed still showed up looking fine. That's
worse than an error — it's a lie in the UI. I changed the log to derive its badge from the
document's real status (`failed` shows red, in-flight shows "processing", done shows "published"),
and made the backend clean up partial field rows on failure so a failed doc never carries
half-real data. The uploaded file is kept, though, so a failure is debuggable and retryable.

A natural next step I didn't build: a per-record retry — one click on a failed document would kick
off the whole extraction flow again for just that file. It's not part of the current flow, but the
pieces are already there (the file's still in storage, the status is `failed`), so it's an easy add
whenever it's wanted.

---

## Verified status is written where the click happens

Auto-verify in the wizard was marking all the fields verified but the *document* status wasn't
flipping to `verified` until you happened to open its detail page. The reason was that the status
was only derived inside a hook mounted on that page. I moved the status write into the verify
mutation itself, so it updates the moment the action happens, wherever it happens. The detail-page
hook still handles the reverse case (edit a verified field and it reopens for review). Small thing,
but it's the kind of lag that makes an app feel broken.

---

## Sticky shell, scrolling content

The sidebar and header stay put; only the content area scrolls. I pinned the layout to the viewport
height and let `main` be the scroll container. It's a small CSS decision but it's the difference
between "feels like an app" and "feels like a long web page" — the nav shouldn't scroll away while
you're paging through documents.

---

## Theming and the collapsible nav

Light/dark toggle and a collapsible sidebar whose state persists to `localStorage`. Honestly these
are the lowest-value things I built relative to the substance work, and I'd tell a reviewer that
directly — they make the demo feel finished but they're not where the thinking is. I kept them
because a polished shell does help a demo land, but I didn't let them crowd out the review screen or
the container work.

---

## Types are hand-written to mirror the schema, and I keep two type files

`src/types/db.ts` mirrors the Postgres schema; `src/types/api.ts` mirrors the two edge-function
contracts. They're hand-written, but the intent is that `db.ts` gets regenerated from the live
schema (`supabase gen types`) so it can't silently drift.

I keep the DB types and the edge-function API contract in separate files on purpose — one is "what
the database is," the other is "what the functions promise." When the container work landed I
updated both sides together (new `container_id`, `field_type`, provenance fields), which is exactly
the discipline the split is meant to enforce: change the contract in one place, feel it in the other.

---

## A couple of things I want to point out

**RLS is wide open.** Every table allows anyone with the anon key to read/write. That's fine for a
single-user assignment and lets the frontend talk to Supabase directly, but it is *not* how this
ships — real auth would scope everything by user/org, and the container-per-org mapping is the clean
seam for it.

**Verification.** The frontend is verified — types compile and the test suite passes against real
renders. On the backend, the Mistral extraction and the Voyage embedding calls now work end to end,
so both query paths (structured filter and semantic search) return real results. The one caveat
worth keeping in mind: a document only shows up in semantic search once its embedding was written,
so anything processed before the embedding call was working needs a re-run to be searchable.

**Tests are targeted, not exhaustive.** I tested the things a silent regression would hurt most —
the shared `DataTable`'s pagination, the document search filter, the field-edit/audit contract, the
file-type guard, the error mapping. No E2E, no snapshot tests. For a build this size, exhaustive
coverage would've been effort spent away from the product.
