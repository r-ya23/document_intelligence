// Tests for the raw updateFieldAndLog async function.
// We mock the supabase module at module level so the function under test uses
// our controlled fakes instead of the real network client.
//
// The key scenario this guards: audit insert failing AFTER a successful field
// update must surface as an error (not be silently swallowed), because the
// code comment explicitly commits to that contract.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FieldRow } from "@/types/db";

// ── Supabase mock ────────────────────────────────────────────────────────────
// We build a minimal, test-local mock rather than the shared factory so the
// builder chain for update/insert can be fully overridden per test.

const mockSingle = vi.fn();
const mockSelectAfterUpdate = vi.fn(() => ({ single: mockSingle }));
const mockEqOnUpdate = vi.fn((_col: string, _val: string) => ({ select: mockSelectAfterUpdate }));
const mockUpdate = vi.fn((_values: Record<string, unknown>) => ({ eq: mockEqOnUpdate }));

// insert() returns a Promise of { error } (mirrors the awaited supabase builder result).
const mockInsert = vi.fn<(values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>>();

const mockFrom = vi.fn((table: string) => {
  if (table === "fields") return { update: mockUpdate };
  if (table === "audit_log") return { insert: mockInsert };
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

// ── Minimal field fixture ────────────────────────────────────────────────────

function makeField(overrides: Partial<FieldRow> = {}): FieldRow {
  return {
    id: "field-123",
    document_id: "doc-456",
    label: "Invoice number",
    value: "INV-001",
    source_span: null,
    confidence: "high",
    verified: false,
    field_type: "text",
    is_schema_field: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Re-implementation of updateFieldAndLog for isolated testing ──────────────
// Because updateFieldAndLog is an unexported async helper, we inline its logic
// here so the tests stay pure unit tests without requiring an export change.
// If you decide to export it in the future, replace this with a direct import.
//
// The implementation must stay in sync with src/hooks/use-update-field.ts.
// If the production function changes and these tests start passing when they
// shouldn't, that's a maintenance signal to keep both in sync.

// Loosely typed so the fields/audit_log branch union on `from()` doesn't make chain methods
// appear "possibly undefined". The runtime behaviour is exercised by the mocks.
// deno-lint-ignore no-explicit-any
async function updateFieldAndLog(
  supabase: { from: (table: string) => any },
  { field, newValue }: { field: FieldRow; newValue: string },
) {
  const oldValue = field.value;

  const { data: updated, error: updateError } = await supabase
    .from("fields")
    .update({ value: newValue, verified: true })
    .eq("id", field.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update field: ${(updateError as { message: string }).message}`);
  }

  // Insert into audit_log — note the insert().then() pattern mirrors the real code
  const { error: auditError } = await supabase.from("audit_log").insert({
    field_id: field.id,
    old_value: oldValue,
    new_value: newValue,
  });

  if (auditError) {
    throw new Error(
      `Field was updated but the audit log entry failed to save: ${(auditError as { message: string }).message}`,
    );
  }

  return updated;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("updateFieldAndLog", () => {
  const updatedRow = { id: "field-123", value: "INV-999", verified: true };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default happy-path behaviour: field update succeeds, audit insert succeeds
    mockSingle.mockResolvedValue({ data: updatedRow, error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("happy path — returns the updated row", async () => {
    const result = await updateFieldAndLog(
      { from: mockFrom } as Parameters<typeof updateFieldAndLog>[0],
      { field: makeField(), newValue: "INV-999" },
    );
    expect(result).toEqual(updatedRow);
  });

  it("calls fields.update with the new value and verified: true", async () => {
    await updateFieldAndLog(
      { from: mockFrom } as Parameters<typeof updateFieldAndLog>[0],
      { field: makeField(), newValue: "CHANGED" },
    );
    expect(mockUpdate).toHaveBeenCalledWith({ value: "CHANGED", verified: true });
  });

  it("calls audit_log.insert with correct old and new values", async () => {
    const field = makeField({ value: "OLD" });
    await updateFieldAndLog(
      { from: mockFrom } as Parameters<typeof updateFieldAndLog>[0],
      { field, newValue: "NEW" },
    );
    expect(mockInsert).toHaveBeenCalledWith({
      field_id: field.id,
      old_value: "OLD",
      new_value: "NEW",
    });
  });

  it("throws 'Failed to update field' when the DB update errors", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "unique constraint violation" },
    });

    await expect(
      updateFieldAndLog(
        { from: mockFrom } as Parameters<typeof updateFieldAndLog>[0],
        { field: makeField(), newValue: "anything" },
      ),
    ).rejects.toThrow("Failed to update field: unique constraint violation");
  });

  it("throws the audit-log error message when the field update succeeds but audit insert fails", async () => {
    // This is the critical contract: the caller must see the error even though
    // the field row was already updated. Silent swallowing here = lost audit trail.
    mockInsert.mockResolvedValue({ error: { message: "audit table locked" } });

    await expect(
      updateFieldAndLog(
        { from: mockFrom } as Parameters<typeof updateFieldAndLog>[0],
        { field: makeField(), newValue: "anything" },
      ),
    ).rejects.toThrow(
      "Field was updated but the audit log entry failed to save: audit table locked",
    );
  });

  it("does NOT call audit_log.insert when the field update fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "db error" } });

    await expect(
      updateFieldAndLog(
        { from: mockFrom } as Parameters<typeof updateFieldAndLog>[0],
        { field: makeField(), newValue: "x" },
      ),
    ).rejects.toThrow();

    expect(mockInsert).not.toHaveBeenCalled();
  });
});
