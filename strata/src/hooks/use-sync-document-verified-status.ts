import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { documentQueryKey } from "@/hooks/use-document";
import type { DocumentRow, FieldRow } from "@/types/db";

// Single source of truth for "is this document verified": all extracted fields must be verified,
// and there must be at least one field (an empty extraction isn't "verified", it's just empty).
// Computed here, not duplicated in the DB or in individual components — components read this
// function's result rather than re-deriving the rule themselves.
export function isDocumentFullyVerified(fields: FieldRow[]): boolean {
  return fields.length > 0 && fields.every((f) => f.verified);
}

// Syncs documents.status -> 'verified' once every field is verified, and back to
// 'ready_for_review' if a field is edited/unverified after that (e.g. a correction reopens
// review). Runs as a side effect whenever the fields list changes, rather than requiring the user
// to manually mark the whole document verified — the status is a derived reflection of field
// state, not an independent input.
export function useSyncDocumentVerifiedStatus(document: DocumentRow | undefined, fields: FieldRow[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!document) return;
    // Only meaningful once extraction has produced fields to verify.
    if (document.status !== "ready_for_review" && document.status !== "verified") return;

    const fullyVerified = isDocumentFullyVerified(fields);
    const targetStatus = fullyVerified ? "verified" : "ready_for_review";

    if (document.status === targetStatus) return;

    supabase
      .from("documents")
      .update({ status: targetStatus })
      .eq("id", document.id)
      .then(({ error }) => {
        if (error) {
          console.error("Failed to sync document verified status:", error.message);
          return;
        }
        queryClient.invalidateQueries({ queryKey: documentQueryKey(document.id) });
      });
  }, [document, fields, queryClient]);
}
