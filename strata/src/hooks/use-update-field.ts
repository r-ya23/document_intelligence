import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fieldsQueryKey, documentQueryKey } from "@/hooks/use-document";
import type { FieldRow } from "@/types/db";

interface UpdateFieldInput {
  field: FieldRow;
  newValue: string;
}

// Updates a field's value and records the change in audit_log, in that order — if the audit
// insert fails after the value update succeeds, we surface the error rather than silently losing
// the audit trail; the caller sees a failed mutation and can retry. There's no DB transaction
// wrapping both statements (no Postgres function defined for it), so this is "best-effort
// sequential consistency", not atomic — acceptable at this scope since the audit log's job is
// traceability, not enforcement.
async function updateFieldAndLog({ field, newValue }: UpdateFieldInput) {
  const oldValue = field.value;

  const { data: updated, error: updateError } = await supabase
    .from("fields")
    .update({ value: newValue, verified: true })
    .eq("id", field.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update field: ${updateError.message}`);
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    field_id: field.id,
    old_value: oldValue,
    new_value: newValue,
  });

  if (auditError) {
    throw new Error(
      `Field was updated but the audit log entry failed to save: ${auditError.message}`,
    );
  }

  return updated;
}

export function useUpdateField(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFieldAndLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fieldsQueryKey(documentId) });
      queryClient.invalidateQueries({ queryKey: documentQueryKey(documentId) });
    },
  });
}

// Marks a field verified without changing its value — for "this looks right, confirm as-is"
// rather than an edit.
export function useVerifyField(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase
        .from("fields")
        .update({ verified: true })
        .eq("id", fieldId);
      if (error) throw new Error(`Failed to verify field: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fieldsQueryKey(documentId) });
      queryClient.invalidateQueries({ queryKey: documentQueryKey(documentId) });
    },
  });
}

// Marks every not-yet-verified field for a document verified in one update — for "everything
// here looks right" rather than clicking "Mark verified" per field. Only touches unverified rows
// (verified ones are left alone, no-op update avoided) via `.eq("verified", false)`.
//
// Also flips documents.status -> 'verified' in the same mutation. Deriving the document status
// only in useSyncDocumentVerifiedStatus meant it lagged: that sync hook is mounted on the
// document detail page, so after auto-verify in the wizard the fields were verified but the
// document row stayed 'ready_for_review' until someone opened the detail page. Writing the status
// here makes it update immediately, wherever verify-all runs (wizard auto-verify, or the manual
// "verify all" button), independent of the sync hook being mounted. The status is guarded so it
// only advances a document that's actually ready for review.
export function useVerifyAllFields(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("fields")
        .update({ verified: true })
        .eq("document_id", documentId)
        .eq("verified", false);
      if (error) throw new Error(`Failed to verify all fields: ${error.message}`);

      // A document is only "verified" if it has at least one field (matches
      // isDocumentFullyVerified — an empty extraction isn't verified, it's just empty).
      const { count, error: countError } = await supabase
        .from("fields")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId);
      if (countError) {
        throw new Error(`Fields verified but field count check failed: ${countError.message}`);
      }
      if (!count || count === 0) return;

      // Advance the document to 'verified' now that all its fields are. Guarded to
      // ready_for_review so this can't overwrite a failed/extracting document.
      const { error: statusError } = await supabase
        .from("documents")
        .update({ status: "verified" })
        .eq("id", documentId)
        .eq("status", "ready_for_review");
      if (statusError) {
        throw new Error(`Fields verified but document status update failed: ${statusError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fieldsQueryKey(documentId) });
      queryClient.invalidateQueries({ queryKey: documentQueryKey(documentId) });
    },
  });
}
