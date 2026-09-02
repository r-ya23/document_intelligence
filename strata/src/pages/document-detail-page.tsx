import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { SourceTextPane } from "@/components/source-text-pane";
import { FieldList } from "@/components/field-list";
import { AuditTrailDialog } from "@/components/audit-trail-dialog";
import { useDocument } from "@/hooks/use-document";
import { useTriggerExtraction } from "@/hooks/use-trigger-extraction";
import { useSyncDocumentVerifiedStatus } from "@/hooks/use-sync-document-verified-status";

const EXTRACTABLE_STATUSES = new Set(["queued", "failed"]);
const IN_PROGRESS_STATUSES = new Set(["extracting", "structuring"]);

export function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { documentQuery, fieldsQuery } = useDocument(documentId);
  const { mutate: triggerExtraction, isPending: isTriggering } = useTriggerExtraction(
    documentId ?? "",
  );
  const [highlightedSpan, setHighlightedSpan] = useState<string | null>(null);

  // Must run on every render regardless of loading/error state below — hooks can't be called
  // conditionally. The hook itself no-ops when `document` is undefined.
  useSyncDocumentVerifiedStatus(documentQuery.data, fieldsQuery.data ?? []);

  if (documentQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (documentQuery.isError || !documentQuery.data) {
    return (
      <p className="text-sm">
        {documentQuery.error instanceof Error
          ? documentQuery.error.message
          : "Failed to load document."}
      </p>
    );
  }

  const doc = documentQuery.data;
  const fields = fieldsQuery.data ?? [];
  const canExtract = EXTRACTABLE_STATUSES.has(doc.status);
  const inProgress = IN_PROGRESS_STATUSES.has(doc.status) || isTriggering;

  function handleExtract() {
    triggerExtraction(undefined, {
      onError: (error) => {
        toast.error("Extraction failed to start", { description: error.message });
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/documents">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{doc.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <DocumentStatusBadge status={doc.status} />
              {doc.doc_type && (
                <span className="text-xs text-muted-foreground capitalize">{doc.doc_type}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fields.length > 0 && <AuditTrailDialog documentId={doc.id} fields={fields} />}
          {canExtract && (
            <Button onClick={handleExtract} disabled={inProgress}>
              {inProgress
                ? "Extracting…"
                : doc.status === "failed"
                  ? "Retry extraction"
                  : "Extract fields"}
            </Button>
          )}
        </div>
      </div>

      {doc.status === "failed" && doc.error_message && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {doc.error_message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6" style={{ minHeight: "70vh" }}>
        <SourceTextPane rawText={doc.raw_text} highlightedSpan={highlightedSpan} />
        <FieldList documentId={doc.id} fields={fields} onHoverField={setHighlightedSpan} />
      </div>
    </div>
  );
}
