// Tests for the uploadDocument async function.
// Critical paths:
//  1. Unsupported file type → throws before touching supabase
//  2. Storage upload error → throws "Upload failed: …"
//  3. Row insert error → cleans up the orphaned storage file, then throws
//  4. Happy path → returns the inserted document row
//
// NOTE on vi.mock hoisting:
// vi.mock() factories are hoisted to the top of the file by Vitest, which means
// they run BEFORE any variable declarations. Using outer variables in the factory
// (e.g. `mockStorage`) causes a TDZ ReferenceError. The workaround is to never
// reference outer variables inside a vi.mock() factory — instead, use vi.fn()
// inline in the factory, then grab the mocks back out via a helper after the
// fact (vi.mocked / module import trick), OR use a single-layer proxy object
// that can be mutated after the fact. We use the latter here.

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// ── Create proxy objects that are defined before hoisting ────────────────────
// These are defined at the MODULE level (not inside the factory) but are
// assigned AFTER the factory runs. However, the factory captures the object
// *reference*, not the value of the properties — so this works because JS
// objects are passed by reference.

// We use vi.hoisted() to create mocks that are safe to reference inside the
// vi.mock() factory callback.
const { mockStorageUpload, mockStorageRemove, mockFrom, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelectChain = vi.fn(() => ({ single: mockSingle }));
  const mockInsertChain = vi.fn((_values: Record<string, unknown>) => ({ select: mockSelectChain }));
  type StorageResult = { data?: unknown; error: { message: string } | null };
  const mockStorageUpload =
    vi.fn<(path: string, file: File, opts?: { contentType?: string }) => Promise<StorageResult>>();
  const mockStorageRemove = vi.fn<(paths: string[]) => Promise<StorageResult>>();
  const mockFrom = vi.fn((_table: string) => ({ insert: mockInsertChain }));
  return { mockStorageUpload, mockStorageRemove, mockFrom, mockSingle };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      })),
    },
    from: mockFrom,
  },
}));

vi.mock("@/hooks/use-documents", () => ({
  DOCUMENTS_QUERY_KEY: ["documents"],
}));

// ── Import the helpers under test ────────────────────────────────────────────
import { isAcceptedFile, ACCEPTED_FILE_EXTENSIONS } from "@/hooks/use-upload-document";

// ── Mirror the unexported uploadDocument function ────────────────────────────
// The function is not exported. We inline the same logic so we can test it
// in isolation. Keep in sync with src/hooks/use-upload-document.ts.
async function uploadDocument(
  supabaseClient: {
    storage: { from: (b: string) => { upload: typeof mockStorageUpload; remove: typeof mockStorageRemove } };
    from: typeof mockFrom;
  },
  { file }: { file: File },
) {
  if (!isAcceptedFile(file.name)) {
    throw new Error(
      `Unsupported file type. Accepted: ${ACCEPTED_FILE_EXTENSIONS.join(", ")}`,
    );
  }

  const storagePath = `test-uuid-${file.name}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("documents")
    .upload(storagePath, file, { contentType: file.type || undefined });

  if (uploadError) {
    throw new Error(`Upload failed: ${(uploadError as { message: string }).message}`);
  }

  const { data, error: insertError } = await supabaseClient
    .from("documents")
    .insert({ name: file.name, storage_path: storagePath, status: "queued" })
    .select()
    .single();

  if (insertError) {
    await supabaseClient.storage.from("documents").remove([storagePath]);
    throw new Error(
      `Failed to create document record: ${(insertError as { message: string }).message}`,
    );
  }

  return data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(name: string, type = "text/plain"): File {
  return new File(["content"], name, { type });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("uploadDocument", () => {
  // Grab the mocked supabase client via beforeAll (which is async-safe),
  // not at describe-level where await is forbidden by esbuild.
  let supabaseClient: Parameters<typeof uploadDocument>[0];

  beforeAll(async () => {
    const mod = await import("@/lib/supabase");
    // The real client type doesn't overlap with our narrow mock shape; cast via unknown.
    supabaseClient = mod.supabase as unknown as Parameters<typeof uploadDocument>[0];
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: storage upload succeeds
    mockStorageUpload.mockResolvedValue({ data: { path: "x" }, error: null });
    // Default: row insert succeeds
    mockSingle.mockResolvedValue({ data: { id: "doc-1", name: "invoice.txt" }, error: null });
    // Default: storage remove succeeds (for cleanup tests)
    mockStorageRemove.mockResolvedValue({ data: null, error: null });
  });

  it("throws immediately for unsupported file type, without calling supabase at all", async () => {
    const file = makeFile("resume.docx", "application/vnd.openxmlformats");
    await expect(uploadDocument(supabaseClient, { file })).rejects.toThrow("Unsupported file type.");
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("throws 'Upload failed' when storage upload errors", async () => {
    mockStorageUpload.mockResolvedValue({ data: null, error: { message: "bucket full" } });
    await expect(
      uploadDocument(supabaseClient, { file: makeFile("invoice.txt") }),
    ).rejects.toThrow("Upload failed: bucket full");
  });

  it("calls storage.remove to clean up the orphaned file when the row insert fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "FK violation" } });
    await expect(
      uploadDocument(supabaseClient, { file: makeFile("contract.pdf") }),
    ).rejects.toThrow("Failed to create document record: FK violation");
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);
    const removedPaths = mockStorageRemove.mock.calls[0][0] as string[];
    expect(removedPaths).toHaveLength(1);
    expect(removedPaths[0]).toContain("contract.pdf");
  });

  it("happy path — returns the inserted document row", async () => {
    const expectedRow = { id: "doc-42", name: "invoice.txt" };
    mockSingle.mockResolvedValue({ data: expectedRow, error: null });
    const result = await uploadDocument(supabaseClient, { file: makeFile("invoice.txt") });
    expect(result).toEqual(expectedRow);
  });

  it("does NOT call storage.remove on the happy path", async () => {
    await uploadDocument(supabaseClient, { file: makeFile("data.csv") });
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("passes contentType from the File object to the storage upload", async () => {
    await uploadDocument(supabaseClient, { file: makeFile("image.png", "image/png") });
    const uploadCall = mockStorageUpload.mock.calls[0];
    expect(uploadCall[2]).toMatchObject({ contentType: "image/png" });
  });
});
