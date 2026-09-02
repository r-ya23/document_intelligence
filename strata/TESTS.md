# Tests — Coverage Reference & Structure Opinion

## On the folder structure

**Short answer: `__tests__/` folders are not the preferred convention for this stack.**

### What we have now

```
src/
  hooks/
    use-document.ts
    __tests__/
      isDocumentFullyVerified.test.ts
      isAcceptedFile.test.ts
      fetchDocument.test.ts
      use-update-field.test.ts
      use-upload-document.test.ts
      isErrorResponse.test.ts
  components/
    confidence-badge.tsx
    __tests__/
      ConfidenceBadge.test.tsx
      DocumentStatusBadge.test.tsx
      sortByConfidence.test.ts
  features/containers/
    use-containers.ts
    __tests__/
      containerStore.test.ts
```

### The problem with `__tests__/` folders

The `__tests__` convention comes from Jest + Node.js backends where tests lived far from source. For a React/Vite/TypeScript project in 2025, it creates friction:

- You **open `use-document.ts` to make a change** — the test is not visible. You navigate to `__tests__/`, find the test, make the change, navigate back. Two extra steps every time.
- **Discoverability breaks** — you can't tell at a glance which files have tests. With co-location, a file without a sibling `.test.ts` is obviously untested.
- **Refactoring is harder** — when you rename or move `use-upload-document.ts`, your IDE may not automatically move `__tests__/use-upload-document.test.ts`. With co-location it's one file move.
- The `__tests__/` folder **adds a navigation level with no architectural benefit** — these are unit tests, not a different category that earns its own tree.

### The recommended structure (co-location)

```
src/
  hooks/
    use-document.ts
    use-document.test.ts                              ← right next to the source
    use-upload-document.ts
    use-upload-document.test.ts
    use-sync-document-verified-status.ts
    use-sync-document-verified-status.test.ts
  components/
    confidence-badge.tsx
    confidence-badge.test.tsx                         ← same directory
    document-status-badge.tsx
    document-status-badge.test.tsx
    field-list.tsx
    field-list.test.ts                                ← sortByConfidence lives here
  features/containers/
    use-containers.ts
    use-containers.test.ts
```

**The only exception:** a top-level `e2e/` or `tests/integration/` folder for tests that span multiple pages, need a real browser, or an MSW server. Those don't belong next to any single file.

### What Vitest/Vite projects standardize on

Vite's own scaffolding, most major React component libraries (Radix, shadcn), and frameworks like Remix all use co-location. `__tests__/` is a carry-over from `create-react-app` and Babel-era Jest setups.

### Should you migrate?

Yes, when convenient. It is a rename-and-move only — Vitest discovers test files by the `.test.ts(x)` extension, not folder names. The `vite.config.ts` `test` block needs no changes.

---

## What the tests cover (all 80 tests)

Organized by the **production bug they prevent**, not by file.

---

### 1 — Document verification correctness

**Source:** `isDocumentFullyVerified` in `src/hooks/use-sync-document-verified-status.ts`

This function is the single source of truth for whether a document flips to `"verified"`. A bug here means documents auto-verify when they shouldn't, or never verify when they should.

| Test | Bug it prevents |
|------|----------------|
| Empty fields → `false` | A document with zero extracted fields must not become "verified" |
| One unverified field → `false` | Partial verification must not count as full |
| All unverified → `false` | — |
| All verified → `true` | Happy path must work |
| Single verified field → `true` | Minimum valid verification |

---

### 2 — File upload gate

**Source:** `isAcceptedFile` in `src/hooks/use-upload-document.ts`

The function that gates which files can be uploaded. Wrong logic means either bad files get through (`.exe`, `.docx`) or valid files get blocked.

| Test | Bug it prevents |
|------|----------------|
| All 10 accepted extensions → `true` | Regression: adding an extension to the list doesn't silently break others |
| `PNG` uppercase → `true` | Case-insensitive check must cover OS file pickers that capitalize extensions |
| `JPEG` uppercase → `true` | Same |
| `.docx` → `false` | Word documents must be rejected (not supported by extract-and-structure) |
| `.exe` → `false` | Executables must be rejected |
| `.xlsx` → `false` | Excel must be rejected |
| `README` (no extension) → `false` | `split('.').pop()` on a no-extension filename returns the whole name, not `""` |
| `report.csv.exe` → `false` | Double-extension: the real extension is the last segment; `.csv` is not the extension here |
| `archive.backup.txt` → `true` | Double-extension where the last part IS valid must still pass |
| `""` (empty string) → `false` | Empty file name must not crash |
| `.` (just a dot) → `false` | A filename of a single dot |

---

### 3 — Upload pipeline and orphan cleanup

**Source:** `uploadDocument` in `src/hooks/use-upload-document.ts`

| Test | Bug it prevents |
|------|----------------|
| Rejected extension throws without calling Supabase | File type check must short-circuit before touching the network |
| Storage error → `"Upload failed: …"` | Raw Supabase error must be wrapped with a usable message |
| Insert error → `storage.remove()` called, then throws | Orphaned files accumulate in storage forever without cleanup |
| Happy path → returns inserted document row | Full pipeline works end-to-end |
| Happy path → `storage.remove()` NOT called | Cleanup must not run when nothing went wrong |
| `contentType` passed to storage upload | Missing content type causes storage to serve files as `application/octet-stream`, breaking in-browser preview |

---

### 4 — Field update and audit trail

**Source:** `updateFieldAndLog` in `src/hooks/use-update-field.ts`

The most important contract: if the audit insert fails after a field update, **the error must surface to the caller** — not be silently swallowed. The source code comment explicitly commits to this.

| Test | Bug it prevents |
|------|----------------|
| Happy path → returns updated row | Baseline |
| `fields.update` called with `{ value, verified: true }` | Wrong update payload would leave fields unverified after editing |
| `audit_log.insert` called with `old_value` and `new_value` | Wrong values in audit entry corrupt the change history |
| DB update error → throws `"Failed to update field: …"` | Error must not be swallowed |
| Audit insert error after successful field update → **throws** | Critical: lost audit trail must be visible to the user |
| Field update fails → `audit_log.insert` NOT called | Must not write an audit entry for a failed update |

---

### 5 — Document fetch error mapping

**Source:** `fetchDocument` in `src/hooks/use-document.ts`

Postgres and supabase-js errors are internal; users must never see raw error text.

| Test | Bug it prevents |
|------|----------------|
| Postgres error `22P02` → `"Document not found."` | A malformed URL UUID would show `"invalid input syntax for type uuid"` to the user without this mapping |
| `"Failed to fetch"` network error → connectivity hint | Raw `"TypeError: Failed to fetch"` is meaningless to a user |
| Generic DB error → wrapped with prefix | Wrapped, not raw |
| `data: null`, no error → `"Document not found."` | Row deleted mid-request must show a clean not-found message |
| Happy path → returns the row | Baseline |
| Queries `documents` table with the correct `id` filter | Wrong filter would load the wrong document |

---

### 6 — Query error type guard

**Source:** `isErrorResponse` in `src/hooks/use-run-query.ts`

The guard separates `ApiErrorResponse` from `QueryResponse`. If it returns `false` for an error shape, the error object flows into the success path and is silently ignored — the user sees empty results instead of an error message.

| Test | Bug it prevents |
|------|----------------|
| `{ error: "bad" }` → `true` | Core case |
| `{ error: "" }` → `true` | Empty error string is still an error |
| Filter-mode response → `false` | Must not mistake a valid response for an error |
| Semantic-mode response → `false` | Same |
| `null` → `false` | Must not throw on null |
| `undefined` → `false` | Must not throw on undefined |
| Number → `false` | Primitive |
| String → `false` | A string is not an error response object |
| `{}` → `false` | Object without the `error` key |
| `{ error: 404 }` → `true` | Guard checks key presence, not value type (matches source impl) |

---

### 7 — Field display ordering

**Source:** `sortByConfidence` in `src/components/field-list.tsx`

`"review"` fields must surface to the top — they need human attention and must not be buried below high-confidence fields.

| Test | Bug it prevents |
|------|----------------|
| Mixed list → all `review` before all `high` | The core ordering guarantee |
| Same confidence → relative order preserved | Sort instability would jumble fields of equal confidence on every render |
| Already sorted list → unchanged | Idempotent sort |
| Original array not mutated | Mutating the input would cause React to miss the state change |
| Empty array → unchanged | Must not throw on empty input |
| Single element → unchanged | Edge case |

---

### 8 — Container store

**Source:** `src/features/containers/use-containers.ts`

The in-memory store is the **only persistence layer for containers** (no DB yet). If it doesn't notify subscribers, components don't re-render after a mutation.

| Test | Bug it prevents |
|------|----------------|
| Subscribe → mutate → listener called once | Components don't update without notification |
| Unsubscribe → mutate → listener NOT called | Memory leak if unsubscribe doesn't work |
| `createContainer` prepends | New container appearing at the bottom of the list instead of the top |
| `createContainer` returns correct shape | Wrong `id`, `docType`, or `defaultMode` in the created object |
| `createContainer` returns the new container | Callers that navigate by ID on creation would get `undefined` |
| `recordExtraction` increments list length | Extraction not appearing in the log |
| `recordExtraction` stores `containerId`, `docCount`, `documentIds` | Wrong data in extraction records |
| `recordExtraction` notifies listeners | Extraction log not updating live |
| `getSnapshot` same reference until mutation | Unnecessary re-renders if reference is unstable |
| `getSnapshot` new reference after mutation | `useSyncExternalStore` components would not re-render without a reference change |

---

### 9 — Badge rendering

**Sources:** `src/components/confidence-badge.tsx`, `src/components/document-status-badge.tsx`

Parametrized over every valid value. One wrong entry in a lookup map fails exactly one test — making the regression obvious and the fix obvious.

| Test | Bug it prevents |
|------|----------------|
| `confidence="review"` → "Needs review" | Swapped labels are invisible at runtime without this |
| `confidence="high"` → "High confidence" | Same |
| `"review"` does not render "High confidence" | Catches "both labels rendered" bug |
| `"high"` does not render "Needs review" | Same |
| 6 × status label tests (queued through failed) | Wrong label for any status in `STATUS_CONFIG` |
| No cross-contamination on "queued" render | Catches duplicate key bugs in the config object |

---

## Gaps (not currently tested)

These are consciously deferred, not forgotten:

| Area | Why deferred |
|------|-------------|
| `useDocument` Realtime subscription setup | Browser WebSocket mock complexity is high; the Realtime layer is a thin wire, not logic |
| Full page renders (`DocumentDetailPage`, `QueryPage`, etc.) | Requires MSW to stub Supabase; better done as e2e with Playwright |
| `useContainers` / `useExtractions` React hooks | The store logic is tested directly; hook wrappers are thin `useSyncExternalStore` calls |
| `fetchDocuments` error mapping | Same pattern as `fetchDocument` — add when the pattern needs to diverge |

---

## Running the tests

```bash
# One-shot (CI)
npm test

# Watch mode (development)
npm run test:watch

# Browser UI with coverage explorer
npm run test:ui
```
