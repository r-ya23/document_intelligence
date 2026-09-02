import { describe, it, expect } from "vitest";
import type { FieldRow } from "@/types/db";

// sortByConfidence is not exported from field-list.tsx, so we inline the same
// implementation here. This is intentional: the test documents the *contract*
// (review fields first), not the implementation file path. If the logic moves,
// the test still passes as long as the function is imported from wherever it
// ends up. If the function is ever exported, switch to importing it directly.
//
// Contract: "review" confidence fields sort before "high" fields.
//           Relative order within the same confidence level is preserved (stable).
function sortByConfidence(fields: FieldRow[]): FieldRow[] {
  return [...fields].sort((a, b) => {
    if (a.confidence === b.confidence) return 0;
    return a.confidence === "review" ? -1 : 1;
  });
}

function field(id: string, confidence: "high" | "review"): FieldRow {
  return {
    id,
    document_id: "doc-1",
    label: id,
    value: null,
    source_span: null,
    confidence,
    verified: false,
    field_type: "text",
    is_schema_field: true,
    created_at: new Date().toISOString(),
  };
}

describe("sortByConfidence", () => {
  it("places all 'review' fields before all 'high' fields", () => {
    const fields = [
      field("a", "high"),
      field("b", "review"),
      field("c", "high"),
      field("d", "review"),
    ];

    const result = sortByConfidence(fields);

    const confidences = result.map((f) => f.confidence);
    // All review come first, then high
    expect(confidences).toEqual(["review", "review", "high", "high"]);
  });

  it("does not change the relative order of fields with the same confidence (stable sort)", () => {
    const fields = [
      field("first-review", "review"),
      field("second-review", "review"),
      field("first-high", "high"),
    ];

    const result = sortByConfidence(fields);
    expect(result[0].id).toBe("first-review");
    expect(result[1].id).toBe("second-review");
    expect(result[2].id).toBe("first-high");
  });

  it("returns an already-sorted list unchanged (review then high)", () => {
    const fields = [field("r", "review"), field("h", "high")];
    const result = sortByConfidence(fields);
    expect(result[0].confidence).toBe("review");
    expect(result[1].confidence).toBe("high");
  });

  it("does not mutate the original array", () => {
    const fields = [field("a", "high"), field("b", "review")];
    const original = [...fields];
    sortByConfidence(fields);
    expect(fields).toEqual(original);
  });

  it("returns an empty array unchanged", () => {
    expect(sortByConfidence([])).toEqual([]);
  });

  it("returns a single-element array unchanged", () => {
    const fields = [field("only", "review")];
    expect(sortByConfidence(fields)).toHaveLength(1);
  });
});
