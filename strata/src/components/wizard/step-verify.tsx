import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { CheckIcon, PencilIcon, XIcon, CircleCheckIcon, CheckCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateField, useVerifyField, useVerifyAllFields } from "@/hooks/use-update-field";
import type { FieldRow } from "@/types/db";

interface StepVerifyProps {
  documentId: string;
  fileName: string;
  fields: FieldRow[];
}

function sortByConfidence(fields: FieldRow[]): FieldRow[] {
  return [...fields].sort((a, b) => {
    if (a.confidence === b.confidence) return 0;
    return a.confidence === "review" ? -1 : 1;
  });
}

// Same verify interaction as FieldList (src/components/field-list.tsx) but without the
// source-text hover pane — the wizard is a focused single-document flow, so the split-pane
// layout used on the document detail page isn't needed here.
export function StepVerify({ documentId, fileName, fields }: StepVerifyProps) {
  const sorted = useMemo(() => sortByConfidence(fields), [fields]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const { mutate: updateField, isPending: isSaving } = useUpdateField(documentId);
  const { mutate: verifyField, isPending: isVerifying } = useVerifyField(documentId);
  const { mutate: verifyAllFields, isPending: isVerifyingAll } = useVerifyAllFields(documentId);

  const unverifiedCount = fields.filter((f) => !f.verified).length;
  const verifiedCount = fields.length - unverifiedCount;

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
      verifyField(field.id);
      cancelEditing();
      return;
    }
    updateField({ field, newValue: draftValue }, { onSuccess: cancelEditing });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Verify extracted fields</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual verify — review all {fields.length} field{fields.length !== 1 ? "s" : ""} from{" "}
          {fileName} before publishing.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {verifiedCount} / {fields.length} verified
        </span>
        {unverifiedCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => verifyAllFields()} disabled={isVerifyingAll}>
            <CheckCheckIcon className="size-4" />
            {isVerifyingAll ? "Marking all verified…" : `Mark all verified (${unverifiedCount})`}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {sorted.map((field) => {
          const isEditing = editingFieldId === field.id;
          return (
            <div
              key={field.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
                field.confidence === "review" && !field.verified && "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {field.label}
                  </p>
                  {field.verified && <CircleCheckIcon className="size-3.5 shrink-0 text-emerald-600" />}
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
                    <Button size="icon-sm" variant="ghost" onClick={() => saveEdit(field)} disabled={isSaving} aria-label="Save">
                      <CheckIcon className="size-4" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={cancelEditing} disabled={isSaving} aria-label="Cancel">
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
                    onClick={() => verifyField(field.id)}
                  >
                    Mark verified
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
