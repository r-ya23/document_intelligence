import { useMutation } from "@tanstack/react-query";
import { routeQuery } from "@/lib/edge-functions";
import type { QueryResponse } from "@/types/api";

function isErrorResponse(response: unknown): response is { error: string } {
  return typeof response === "object" && response !== null && "error" in response;
}

export function useRunQuery() {
  return useMutation({
    mutationFn: async (query: string): Promise<QueryResponse> => {
      const response = await routeQuery(query);
      if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
      return response;
    },
  });
}
