// Shared factory for mocking the Supabase client in unit tests.
// Import this in a vi.mock() factory call so each test file gets a fresh,
// configurable mock without reimplementing the builder chain.
//
// Usage in a test file:
//   vi.mock("@/lib/supabase", () => import("@/test/mocks/supabase"));
//
// Then in an individual test, override return values with:
//   mockFrom.mockReturnValueOnce({ ... })
//
// The builder chain (.from → .update/.insert/.select → .eq → .single)
// returns a frozen "fluent" object that resolves to { data: null, error: null }
// by default. Override leaf nodes per-test.

import { vi } from "vitest";

// ── Leaf resolvers ──────────────────────────────────────────────────────────

/** Resolves the terminal .single() / plain await on the chain */
export const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });

/** Resolves plain awaits at the end of a chain (no .single()) */
export const mockResolve = vi.fn().mockResolvedValue({ data: null, error: null });

// ── Query builder chain ─────────────────────────────────────────────────────
// Each builder method returns a new object exposing the next layer.
// Methods that can be the final await resolve via mockResolve; only
// .single() resolves via mockSingle so tests can distinguish them.

const chain: Record<string, unknown> = {};

const makeChain = (): typeof chain => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle: mockSingle,
  single: mockSingle,
  // Allow the chain itself to be awaited
  then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
});

export const mockUpdate = vi.fn(() => makeChain());
export const mockInsert = vi.fn(() => makeChain());
export const mockSelect = vi.fn(() => makeChain());
export const mockFrom = vi.fn((_table: string) => ({
  select: mockSelect,
  update: mockUpdate,
  insert: mockInsert,
}));

// ── Storage ─────────────────────────────────────────────────────────────────

export const mockStorageUpload = vi.fn().mockResolvedValue({ data: null, error: null });
export const mockStorageRemove = vi.fn().mockResolvedValue({ data: null, error: null });

const mockStorageBucket = {
  upload: mockStorageUpload,
  remove: mockStorageRemove,
};

export const mockStorage = {
  from: vi.fn().mockReturnValue(mockStorageBucket),
};

// ── Functions (Edge Functions) ───────────────────────────────────────────────

export const mockFunctionsInvoke = vi.fn().mockResolvedValue({ data: null, error: null });

export const mockFunctions = {
  invoke: mockFunctionsInvoke,
};

// ── Channel / Realtime ───────────────────────────────────────────────────────

export const mockSubscribe = vi.fn().mockReturnThis();
export const mockChannelOn = vi.fn().mockReturnThis();
export const mockChannel = vi.fn().mockReturnValue({
  on: mockChannelOn,
  subscribe: mockSubscribe,
});
export const mockRemoveChannel = vi.fn();

// ── The exported supabase singleton ─────────────────────────────────────────

export const supabase = {
  from: mockFrom,
  storage: mockStorage,
  functions: mockFunctions,
  channel: mockChannel,
  removeChannel: mockRemoveChannel,
};
