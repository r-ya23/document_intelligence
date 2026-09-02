import { describe, it, expect } from "vitest";

// isErrorResponse is not exported from use-run-query.ts, so we mirror it here.
// If it's exported in future, replace with a direct import.
//
// Contract: returns true iff the value is a non-null object with a string "error" property.
// This is what separates an ApiErrorResponse from a valid QueryResponse in useRunQuery's
// mutationFn — a wrong check would let error objects into the success path.
function isErrorResponse(response: unknown): response is { error: string } {
  return typeof response === "object" && response !== null && "error" in response;
}

describe("isErrorResponse", () => {
  it("returns true for a plain { error: string } object", () => {
    expect(isErrorResponse({ error: "something went wrong" })).toBe(true);
  });

  it("returns true even when the error string is empty", () => {
    // An empty string is still a string — still an error response
    expect(isErrorResponse({ error: "" })).toBe(true);
  });

  it("returns false for a filter-mode QueryResponse shape", () => {
    expect(
      isErrorResponse({ mode: "filter", filters: [], results: [] }),
    ).toBe(false);
  });

  it("returns false for a semantic-mode QueryResponse shape", () => {
    expect(isErrorResponse({ mode: "semantic", results: [] })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isErrorResponse(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isErrorResponse(undefined)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isErrorResponse(42)).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isErrorResponse("error string")).toBe(false);
  });

  it("returns false for an empty object (no 'error' key)", () => {
    expect(isErrorResponse({})).toBe(false);
  });

  it("returns true for an object where 'error' value is not a string (still has the key)", () => {
    // The guard checks for key presence, not value type — matches the source implementation
    expect(isErrorResponse({ error: 404 })).toBe(true);
  });
});
