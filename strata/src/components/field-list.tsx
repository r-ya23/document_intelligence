import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { CheckIcon, PencilIcon, XIcon, CircleCheckIcon } from "lucide-react";
import { useUpdateField, useVerifyField } from "@/hooks/use-update-field";
import type { FieldRow } from "@/types/db";

interface FieldListProps {
  documentId: string;
  fields: FieldRow[];
  onHoverField: (span: string | null) => void;
}

// "review" confidence fields surface to the top — these are the ones that need attention before
// a document can be verified, so they shouldn't be buried below high-confidence fields.
function sortByConfidence(fields: FieldRow[]): FieldRow[] {
  return [...fields].sort((a, b) => {
    if (a.confidence === b.confidence) return 0;
    return a.confidence === "review" ? -1 : 1;
  });
}

export function FieldList({ documentId, fields, onHoverField }: FieldListProps) {
  const sorted = useMemo(() => sortByConfidence(fields), [fields]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const { mutate: updateField, isPending: isSaving } = useUpdateField(documentId);
  const { mutate: verifyField, isPending: isVerifying } = useVerifyField(documentId);

  if (fields.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        No fields extracted yet.
      </div>
    );
  }

  function startEditing(field: FieldRow) {
    setEditingFieldId(field.id);
    setDraftValue(field.value ?? "");
  }

  function cancelEditing() {
    setEditingFieldId(null);
    setDraftValue("");
  }

  function saveEdit(field: FieldRow) {
    if (draftValue === field.value) {
      // No actual change — treat as a verify-as-is rather than writing a no-op audit entry.
      verifyField(field.id, {
        onError: (error) => toast.error("Failed to verify field", { description: error.message }),
      });
      cancelEditing();
      return;
    }

    updateField(
      { field, newValue: draftValue },
      {
        onSuccess: () => {
          toast.success(`${field.label} updated`);
          cancelEditing();
        },
        onError: (error) => {
          toast.error("Failed to save field", { description: error.message });
        },
      },
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((field) => {
        const isEditing = editingFieldId === field.id;
        return (
          <Card
            key={field.id}
            className="cursor-default gap-2 py-3"
            onMouseEnter={() => !isEditing && onHoverField(field.source_span)}
            onMouseLeave={() => !isEditing && onHoverField(null)}
          >
            <CardContent className="flex items-start justify-between gap-3 px-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {field.label}
                  </p>
                  {field.verified && (
                    <CircleCheckIcon className="size-3.5 shrink-0 text-emerald-600" />
                  )}
                </div>
                {isEditing ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Input
                      autoFocus
                      value={draftValue}
                      onChange={(e) => setDraftValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(field);
                        if (e.key === "Escape") cancelEditing();
                      }}
                      disabled={isSaving}
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => saveEdit(field)}
                      disabled={isSaving}
                      aria-label="Save"
                    >
                      <CheckIcon className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={cancelEditing}
                      disabled={isSaving}
                      aria-label="Cancel"
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="group mt-1 flex items-center gap-1.5 text-left"
                    onClick={() => startEditing(field)}
                  >
                    <span className="truncate text-sm">{field.value ?? "—"}</span>
                    <PencilIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <ConfidenceBadge confidence={field.confidence} />
                {!field.verified && !isEditing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-xs"
                    disabled={isVerifying}
                    onClick={() =>
                      verifyField(field.id, {
                        onError: (error) =>
                          toast.error("Failed to verify field", { description: error.message }),
                      })
                    }
                  >
                    Mark verified
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
