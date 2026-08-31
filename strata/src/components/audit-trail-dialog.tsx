import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HistoryIcon } from "lucide-react";
import { useAuditLog } from "@/hooks/use-audit-log";
import type { FieldRow } from "@/types/db";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

interface AuditTrailDialogProps {
  documentId: string;
  fields: FieldRow[];
}

// Read-only timeline: old value -> new value, timestamped. Compliance/trust feature — a simple
// list is enough here, not a place to over-design (per the plan's Day 3 scope note).
export function AuditTrailDialog({ documentId, fields }: AuditTrailDialogProps) {
  const { data: entries, isLoading } = useAuditLog(documentId, fields);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <HistoryIcon className="size-4" />
          Audit trail
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Audit trail</DialogTitle>
          <DialogDescription>
            Every correction made to this document's fields, most recent first.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && (!entries || entries.length === 0) && (
            <p className="text-sm text-muted-foreground">No edits recorded yet.</p>
          )}
          {entries?.map((entry) => (
            <div key={entry.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {entry.field_label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(entry.edited_at)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-muted-foreground line-through">
                  {entry.old_value ?? "—"}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{entry.new_value ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
