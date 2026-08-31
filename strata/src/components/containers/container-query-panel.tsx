import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchIcon } from "lucide-react";
import { useRunQuery } from "@/hooks/use-run-query";
import { QueryResults } from "@/components/query-results";
import type { Container } from "@/features/containers/types";

interface ContainerQueryPanelProps {
  container: Container;
}

// Wraps the existing query UI, scoped visually to this container. The underlying query-router
// Edge Function isn't container-aware yet (no `containers`/`container_id` column in the DB), so
// this still queries across all documents — framed as per-container until that wiring exists.
export function ContainerQueryPanel({ container }: ContainerQueryPanelProps) {
  const [query, setQuery] = useState("");
  const { mutate, data, isPending, isError, error } = useRunQuery();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    mutate(query.trim());
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`e.g. ${container.docType}s over 2,00,000 due in the next 30 days`}
          className="h-10"
        />
        <Button type="submit" disabled={isPending || !query.trim()}>
          <SearchIcon className="size-4" />
          {isPending ? "Searching…" : "Search"}
        </Button>
      </form>

      {isPending && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Query failed."}
        </p>
      )}

      {!isPending && data && <QueryResults response={data} />}

      {!isPending && !data && !isError && (
        <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          <p>Try a question like:</p>
          <p className="mt-2 italic">"{container.docType}s with total_due greater than 500"</p>
        </div>
      )}
    </div>
  );
}
