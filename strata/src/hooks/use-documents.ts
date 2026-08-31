import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DocumentRow } from "@/types/db";

export const DOCUMENTS_QUERY_KEY = ["documents"] as const;

async function fetchDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    // supabase-js surfaces network-level failures (server unreachable) as a raw
    // "TypeError: Failed to fetch" — not useful to a user, so give a specific hint instead.
    if (error.message.includes("Failed to fetch")) {
      throw new Error("Can't reach the server. Check your connection and try again.");
    }
    throw new Error(error.message);
  }
  return data ?? [];
}

// List query + Realtime subscription in one hook: any insert/update on `documents` invalidates
// the query so the list re-fetches and re-renders with the latest status, without polling.
export function useDocuments() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: fetchDocuments,
  });

  useEffect(() => {
    const channel = supabase
      .channel("documents-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        () => {
          queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
