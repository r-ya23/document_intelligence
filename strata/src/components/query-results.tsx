import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { TableIcon, BracesIcon } from "lucide-react";
import type { QueryResponse, FilterModeResult } from "@/types/api";
import type { MatchDocumentsResult } from "@/types/db";

interface QueryResultsProps {
  response: QueryResponse;
}

const filterColumns: DataTableColumn<FilterModeResult>[] = [
  { id: "name", header: "Name", cell: (d) => d.name, className: "font-medium" },
  {
    id: "type",
    header: "Type",
    cell: (d) => d.doc_type ?? "—",
    className: "text-muted-foreground",
  },
  { id: "status", header: "Status", cell: (d) => d.status },
  {
    id: "fields",
    header: "Matching fields",
    cell: (d) => d.fields.map((f) => `${f.label}: ${f.value ?? "—"}`).join(", "),
    className: "text-muted-foreground",
  },
];

const semanticColumns: DataTableColumn<MatchDocumentsResult>[] = [
  { id: "name", header: "Name", cell: (d) => d.name, className: "font-medium" },
  {
    id: "type",
    header: "Type",
    cell: (d) => d.doc_type ?? "—",
    className: "text-muted-foreground",
  },
  { id: "similarity", header: "Similarity", cell: (d) => `${(d.similarity * 100).toFixed(1)}%` },
];

// Table for structured filter results (columns = field labels) — JSON for semantic search
// results too, via a toggle, since raw JSON is a useful debug view. Mode is always shown so the
// user can see which path the query classification took, as a trust/debug signal. Table view uses
// the shared DataTable, so both result modes are paginated.
export function QueryResults({ response }: QueryResultsProps) {
  const [view, setView] = useState<"table" | "json">("table");

  if (response.results.length === 0) {
    return <EmptyState mode={response.mode} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="capitalize">
          {response.mode} mode
        </Badge>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={view === "table" ? "secondary" : "ghost"}
            onClick={() => setView("table")}
          >
            <TableIcon className="size-4" />
            Table
          </Button>
          <Button
            size="sm"
            variant={view === "json" ? "secondary" : "ghost"}
            onClick={() => setView("json")}
          >
            <BracesIcon className="size-4" />
            JSON
          </Button>
        </div>
      </div>

      {view === "json" ? (
        <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-4 text-xs">
          {JSON.stringify(response.results, null, 2)}
        </pre>
      ) : response.mode === "filter" ? (
        <DataTable columns={filterColumns} data={response.results} getRowKey={(d) => d.id} />
      ) : (
        <DataTable columns={semanticColumns} data={response.results} getRowKey={(d) => d.id} />
      )}
    </div>
  );
}

function EmptyState({ mode }: { mode: "filter" | "semantic" }) {
  return (
    <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
      No {mode === "filter" ? "documents matched those filters" : "semantic matches found"}.
    </div>
  );
}
