import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AuditLogRow, FieldRow } from "@/types/db";

export interface AuditLogEntryWithFieldLabel extends AuditLogRow {
  field_label: string;
}

export function auditLogQueryKey(documentId: string) {
  return ["documents", documentId, "audit-log"] as const;
}

// audit_log rows reference fields by field_id only — join client-side against the already-fetched
// fields list rather than adding a Postgres join, since we already have field labels in memory
// from useDocument and the audit list is small (per-document, not global).
async function fetchAuditLog(fields: FieldRow[]): Promise<AuditLogEntryWithFieldLabel[]> {
  const fieldIds = fields.map((f) => f.id);
  if (fieldIds.length === 0) return [];

  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .in("field_id", fieldIds)
    .order("edited_at", { ascending: false });

  if (error) throw new Error(`Failed to load audit log: ${error.message}`);

  const labelByFieldId = new Map(fields.map((f) => [f.id, f.label]));
  return (data ?? []).map((entry) => ({
    ...entry,
    field_label: labelByFieldId.get(entry.field_id) ?? "Unknown field",
  }));
}

export function useAuditLog(documentId: string | undefined, fields: FieldRow[]) {
  return useQuery({
    queryKey: documentId ? auditLogQueryKey(documentId) : ["documents", "undefined", "audit-log"],
    queryFn: () => fetchAuditLog(fields),
    enabled: !!documentId && fields.length > 0,
  });
}
