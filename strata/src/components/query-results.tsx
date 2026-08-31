import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableIcon, BracesIcon } from "lucide-react";
import type { QueryResponse, FilterModeResult } from "@/types/api";
import type { MatchDocumentsResult } from "@/types/db";

interface QueryResultsProps {
  response: QueryResponse;
}

// Table for structured filter results (columns = field labels) — JSON for semantic search
// results, since similarity matches don't map cleanly to a fixed set of columns. Mode is always
// shown so the user can see which path the query classification took, as a trust/debug signal.
export function QueryResults({ response }: QueryResultsProps) {
  const [view, setView] = useState<"table" | "json">("table");

  if (response.mode === "semantic" && response.results.length === 0) {
    return <EmptyState mode={response.mode} />;
  }
  if (response.mode === "filter" && response.results.length === 0) {
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
        <FilterResultsTable results={response.results} />
      ) : (
        <SemanticResultsTable results={response.results} />
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

function FilterResultsTable({ results }: { results: FilterModeResult[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Matching fields</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="font-medium">{doc.name}</TableCell>
            <TableCell className="text-muted-foreground">{doc.doc_type ?? "—"}</TableCell>
            <TableCell>{doc.status}</TableCell>
            <TableCell className="text-muted-foreground">
              {doc.fields.map((f) => `${f.label}: ${f.value ?? "—"}`).join(", ")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SemanticResultsTable({ results }: { results: MatchDocumentsResult[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Similarity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="font-medium">{doc.name}</TableCell>
            <TableCell className="text-muted-foreground">{doc.doc_type ?? "—"}</TableCell>
            <TableCell>{(doc.similarity * 100).toFixed(1)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
