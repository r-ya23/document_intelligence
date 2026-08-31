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
