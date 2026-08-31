import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { useDocuments } from "@/hooks/use-documents";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DocumentList() {
  const { data: documents, isLoading, isError, error } = useDocuments();
  const navigate = useNavigate();

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Uploaded</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow
            key={doc.id}
            className="cursor-pointer"
            onClick={() => navigate(`/documents/${doc.id}`)}
          >
            <TableCell className="font-medium">{doc.name}</TableCell>
            <TableCell className="text-muted-foreground">{doc.doc_type ?? "—"}</TableCell>
            <TableCell>
              <DocumentStatusBadge status={doc.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(doc.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
