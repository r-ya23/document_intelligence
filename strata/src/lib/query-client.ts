import { QueryClient } from "@tanstack/react-query";

// Sensible defaults for this app: data changes via user action (upload, edit) or Realtime push,
// not by polling, so a moderate staleTime avoids redundant refetches without going stale for long.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
