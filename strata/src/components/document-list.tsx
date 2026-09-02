import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { useDocuments } from "@/hooks/use-documents";
import type { DocumentRow } from "@/types/db";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const columns: DataTableColumn<DocumentRow>[] = [
  { id: "name", header: "Name", cell: (d) => d.name, className: "font-medium" },
  {
    id: "type",
    header: "Type",
    cell: (d) => d.doc_type ?? "—",
    className: "text-muted-foreground",
  },
  { id: "status", header: "Status", cell: (d) => <DocumentStatusBadge status={d.status} /> },
  {
    id: "uploaded",
    header: "Uploaded",
    cell: (d) => formatDate(d.created_at),
    className: "text-muted-foreground",
  },
];

export function DocumentList() {
  const { data: documents, isLoading, isError, error } = useDocuments();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Filter by document name or doc type (case-insensitive substring). DataTable handles paging
  // over the filtered result and resets to page 1 when the count changes.
  const filtered = useMemo(() => {
    if (!documents) return [];
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (doc) =>
        doc.name.toLowerCase().includes(q) ||
        (doc.doc_type ?? "").toLowerCase().includes(q),
    );
  }, [documents, search]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load documents."}
      </p>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        No documents yet. Upload one to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search box — filters by name or type across the whole list. */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents by name or type…"
          className="pl-9 pr-9"
          aria-label="Search documents"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(doc) => doc.id}
        onRowClick={(doc) => navigate(`/documents/${doc.id}`)}
        emptyState={
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            No documents match "{search.trim()}".
          </div>
        }
      />
    </div>
  );
}
