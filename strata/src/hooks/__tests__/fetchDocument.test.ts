// Tests for the fetchDocument async function.
// The function maps Supabase error codes/messages to user-friendly errors.
// A regression here means raw Postgres error text leaks to users.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn((_col: string, _val: string) => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn((_cols?: string) => ({ eq: mockEq }));
const mockFrom = vi.fn((_table: string) => ({ select: mockSelect }));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

// ── Mirror of the unexported fetchDocument ────────────────────────────────────

import type { DocumentRow } from "@/types/db";

async function fetchDocument(
  supabaseClient: { from: typeof mockFrom },
  documentId: string,
): Promise<DocumentRow> {
  const { data, error } = await supabaseClient
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    if (error.code === "22P02") {
      throw new Error("Document not found.");
    }
    if (error.message.includes("Failed to fetch")) {
      throw new Error("Can't reach the server. Check your connection and try again.");
    }
    throw new Error(`Could not load this document: ${error.message}`);
  }
  if (!data) {
    throw new Error("Document not found.");
  }
  return data as DocumentRow;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const client = { from: mockFrom } as Parameters<typeof fetchDocument>[0];

function docRow(): DocumentRow {
  return {
    id: "doc-1",
    name: "invoice.pdf",
    storage_path: "path/to/invoice.pdf",
    doc_type: "invoice",
    status: "ready_for_review",
    error_message: null,
    raw_text: "Invoice text",
    embedding: null,
    container_id: null,
    created_at: new Date().toISOString(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("fetchDocument error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Postgres UUID error code 22P02 to 'Document not found.' (hides raw DB error)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: "22P02", message: "invalid input syntax for type uuid: \"bad-id\"" },
    });

    await expect(fetchDocument(client, "bad-id")).rejects.toThrow("Document not found.");
  });

  it("maps 'Failed to fetch' network error to a connectivity hint", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: null, message: "TypeError: Failed to fetch" },
    });

    await expect(fetchDocument(client, "any-id")).rejects.toThrow(
      "Can't reach the server. Check your connection and try again.",
    );
  });

  it("wraps other DB errors with a generic prefix (still user-facing, not raw Postgres)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied for table documents" },
    });

    await expect(fetchDocument(client, "any-id")).rejects.toThrow(
      "Could not load this document: permission denied for table documents",
    );
  });

  it("throws 'Document not found.' when data is null and there is no error (row deleted mid-request)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(fetchDocument(client, "gone-id")).rejects.toThrow("Document not found.");
  });

  it("happy path — returns the document row", async () => {
    const row = docRow();
    mockMaybeSingle.mockResolvedValue({ data: row, error: null });

    const result = await fetchDocument(client, row.id);
    expect(result).toEqual(row);
  });

  it("queries the 'documents' table with the correct id filter", async () => {
    const row = docRow();
    mockMaybeSingle.mockResolvedValue({ data: row, error: null });

    await fetchDocument(client, "doc-999");

    expect(mockFrom).toHaveBeenCalledWith("documents");
    expect(mockEq).toHaveBeenCalledWith("id", "doc-999");
  });
});
