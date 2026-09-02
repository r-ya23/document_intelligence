import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { DocumentRow } from "@/types/db";

// The document list's search filter is client-side logic worth guarding: it filters by name AND
// type, and must not leak rows that don't match. useDocuments is mocked so we test the component's
// own filtering, not Supabase.
const mockUseDocuments = vi.fn();
vi.mock("@/hooks/use-documents", () => ({
  useDocuments: () => mockUseDocuments(),
}));

import { DocumentList } from "@/components/document-list";

function doc(partial: Partial<DocumentRow> & Pick<DocumentRow, "id" | "name">): DocumentRow {
  return {
    storage_path: "path",
    doc_type: "invoice",
    status: "ready_for_review",
    error_message: null,
    raw_text: null,
    embedding: null,
    container_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function renderList() {
  return render(
    <MemoryRouter>
      <DocumentList />
    </MemoryRouter>,
  );
}

describe("DocumentList search", () => {
  beforeEach(() => {
    mockUseDocuments.mockReset();
  });

  it("shows the empty state when there are no documents at all", () => {
    mockUseDocuments.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderList();
    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
  });

  it("filters rows by name as the user types", async () => {
    const user = userEvent.setup();
    mockUseDocuments.mockReturnValue({
      data: [
        doc({ id: "1", name: "Acme invoice" }),
        doc({ id: "2", name: "Globex contract", doc_type: "contract" }),
      ],
      isLoading: false,
      isError: false,
    });
    renderList();

    expect(screen.getByText("Acme invoice")).toBeInTheDocument();
    expect(screen.getByText("Globex contract")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/search documents/i), "acme");

    expect(screen.getByText("Acme invoice")).toBeInTheDocument();
    expect(screen.queryByText("Globex contract")).not.toBeInTheDocument();
  });

  it("filters by doc type as well as name", async () => {
    const user = userEvent.setup();
    mockUseDocuments.mockReturnValue({
      data: [
        doc({ id: "1", name: "Acme invoice", doc_type: "invoice" }),
        doc({ id: "2", name: "Globex agreement", doc_type: "contract" }),
      ],
      isLoading: false,
      isError: false,
    });
    renderList();

    await user.type(screen.getByLabelText(/search documents/i), "contract");

    expect(screen.getByText("Globex agreement")).toBeInTheDocument();
    expect(screen.queryByText("Acme invoice")).not.toBeInTheDocument();
  });

  it("shows a no-match message and restores rows when the search is cleared", async () => {
    const user = userEvent.setup();
    mockUseDocuments.mockReturnValue({
      data: [doc({ id: "1", name: "Acme invoice" })],
      isLoading: false,
      isError: false,
    });
    renderList();

    await user.type(screen.getByLabelText(/search documents/i), "zzz");
    expect(screen.getByText(/no documents match/i)).toBeInTheDocument();

    await user.click(screen.getByLabelText(/clear search/i));
    expect(screen.getByText("Acme invoice")).toBeInTheDocument();
  });
});
