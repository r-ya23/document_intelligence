import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DocumentRow, FieldRow } from "@/types/db";

export function documentQueryKey(documentId: string) {
  return ["documents", documentId] as const;
}

export function fieldsQueryKey(documentId: string) {
  return ["documents", documentId, "fields"] as const;
}

async function fetchDocument(documentId: string): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    // Postgres rejects malformed UUIDs before RLS/query even runs — same user-facing outcome as
    // "not found", so both collapse to one friendly message rather than leaking the raw
    // Postgres error text ("invalid input syntax for type uuid: ...").
    if (error.code === "22P02") {
      throw new Error("Document not found.");
    }
    if (error.message.includes("Failed to fetch")) {
      throw new Error("Can't reach the server. Check your connection and try again.");
    }
    throw new Error(`Could not load this document: ${error.message}`);
  }
  if (!data) {
    throw new Error("Document not found.");
  }
  return data;
}

async function fetchFields(documentId: string): Promise<FieldRow[]> {
  const { data, error } = await supabase
    .from("fields")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.message.includes("Failed to fetch")) {
      throw new Error("Can't reach the server. Check your connection and try again.");
    }
    throw new Error(error.message);
  }
  return data ?? [];
}

// Single document + its fields, with Realtime subscriptions on both — so extraction progress
// (status transitions) and field inserts/edits (verification loop, task 11) show up live without
// the user needing to refresh or re-navigate.
export function useDocument(documentId: string | undefined) {
  const queryClient = useQueryClient();

  const documentQuery = useQuery({
    queryKey: documentId ? documentQueryKey(documentId) : ["documents", "undefined"],
    queryFn: () => fetchDocument(documentId!),
    enabled: !!documentId,
  });

  const fieldsQuery = useQuery({
    queryKey: documentId ? fieldsQueryKey(documentId) : ["documents", "undefined", "fields"],
    queryFn: () => fetchFields(documentId!),
    enabled: !!documentId,
  });

  useEffect(() => {
    if (!documentId) return;

    const channel = supabase
      .channel(`document-${documentId}-changes`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `id=eq.${documentId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: documentQueryKey(documentId) });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fields",
          filter: `document_id=eq.${documentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: fieldsQueryKey(documentId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId, queryClient]);

  return { documentQuery, fieldsQuery };
}
