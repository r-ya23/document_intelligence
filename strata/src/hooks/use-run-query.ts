import { useMutation } from "@tanstack/react-query";
import { routeQuery } from "@/lib/edge-functions";
import type { QueryResponse } from "@/types/api";

function isErrorResponse(response: unknown): response is { error: string } {
  return typeof response === "object" && response !== null && "error" in response;
}

interface RunQueryInput {
  query: string;
  // when set, scopes the search to a single container; omit for global search
  containerId?: string | null;
}

export function useRunQuery() {
  return useMutation({
    mutationFn: async ({ query, containerId }: RunQueryInput): Promise<QueryResponse> => {
      const response = await routeQuery(query, containerId);
      if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
      return response;
    },
  });
}
