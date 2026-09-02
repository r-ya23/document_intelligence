import { describe, it, expect, vi } from "vitest";

// use-upload-document imports supabase at module level — mock it so these
// pure-logic tests for isAcceptedFile don't need env vars set.
vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(), storage: { from: vi.fn() } },
}));

import { isAcceptedFile, ACCEPTED_FILE_EXTENSIONS } from "@/hooks/use-upload-document";

describe("isAcceptedFile", () => {
  // ── accepted types ──────────────────────────────────────────────────────

  it.each(ACCEPTED_FILE_EXTENSIONS)(
    "returns true for a standard .%s file",
    (ext) => {
      expect(isAcceptedFile(`document.${ext}`)).toBe(true);
    },
  );

  it("is case-insensitive — PNG uppercase is accepted", () => {
    expect(isAcceptedFile("photo.PNG")).toBe(true);
  });

  it("is case-insensitive — JPEG uppercase is accepted", () => {
    expect(isAcceptedFile("scan.JPEG")).toBe(true);
  });

  // ── rejected types ──────────────────────────────────────────────────────

  it("returns false for a .docx file (unsupported)", () => {
    expect(isAcceptedFile("report.docx")).toBe(false);
  });

  it("returns false for a .exe file", () => {
    expect(isAcceptedFile("malware.exe")).toBe(false);
  });

  it("returns false for a .xlsx file", () => {
    expect(isAcceptedFile("data.xlsx")).toBe(false);
  });

  // ── edge cases ──────────────────────────────────────────────────────────

  it("returns false for a file with no extension at all", () => {
    // split('.').pop() on 'README' returns 'README' which is not in the list
    expect(isAcceptedFile("README")).toBe(false);
  });

  it("resolves the LAST segment for double-extension files — report.csv.exe is rejected", () => {
    // The real extension parsed is 'exe', not 'csv'
    expect(isAcceptedFile("report.csv.exe")).toBe(false);
  });

  it("a double-extension file where the last part IS valid is accepted — archive.backup.txt", () => {
    expect(isAcceptedFile("archive.backup.txt")).toBe(true);
  });

  it("returns false for an empty string", () => {
    // split('').pop() → '' which is not accepted
    expect(isAcceptedFile("")).toBe(false);
  });

  it("returns false for a filename that is just a dot", () => {
    expect(isAcceptedFile(".")).toBe(false);
  });
});
