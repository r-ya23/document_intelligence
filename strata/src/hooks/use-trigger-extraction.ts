import { useMutation, useQueryClient } from "@tanstack/react-query";
import { extractAndStructure } from "@/lib/edge-functions";
import { documentQueryKey, fieldsQueryKey } from "@/hooks/use-document";

// Triggers the extract-and-structure Edge Function. The function itself pushes status updates
// (extracting -> structuring -> ready_for_review/failed) via direct DB writes, picked up by the
// Realtime subscription in useDocument — this mutation just kicks it off and refreshes local
// state once the call resolves, as a fallback in case Realtime is slow to deliver.
export function useTriggerExtraction(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => extractAndStructure(documentId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: documentQueryKey(documentId) });
      queryClient.invalidateQueries({ queryKey: fieldsQueryKey(documentId) });
    },
  });
}
