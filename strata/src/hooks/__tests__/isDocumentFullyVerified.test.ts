import { describe, it, expect, vi } from "vitest";

// use-sync-document-verified-status.ts imports supabase at module level, which
// throws if VITE_SUPABASE_URL/ANON_KEY are not set. Mock it so the pure
// isDocumentFullyVerified function is testable without any env config.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));

import { isDocumentFullyVerified } from "@/hooks/use-sync-document-verified-status";
import type { FieldRow } from "@/types/db";

// Minimal FieldRow — only the fields that isDocumentFullyVerified reads.
function field(verified: boolean): FieldRow {
  return {
    id: crypto.randomUUID(),
    document_id: "doc-1",
    label: "Invoice number",
    value: "INV-001",
    source_span: null,
    confidence: "high",
    verified,
    created_at: new Date().toISOString(),
  };
}

describe("isDocumentFullyVerified", () => {
  it("returns false for an empty fields list — an empty extraction is not 'verified'", () => {
    expect(isDocumentFullyVerified([])).toBe(false);
  });

  it("returns false when at least one field is unverified", () => {
    const fields = [field(true), field(false), field(true)];
    expect(isDocumentFullyVerified(fields)).toBe(false);
  });

  it("returns false when all fields are unverified", () => {
    const fields = [field(false), field(false)];
    expect(isDocumentFullyVerified(fields)).toBe(false);
  });

  it("returns true when every field is verified and there is at least one field", () => {
    const fields = [field(true), field(true), field(true)];
    expect(isDocumentFullyVerified(fields)).toBe(true);
  });

  it("returns true for a single verified field", () => {
    expect(isDocumentFullyVerified([field(true)])).toBe(true);
  });
});
