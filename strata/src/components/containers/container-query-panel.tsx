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

// Query UI scoped to this container: passes container.id to query-router, which filters both the
// structured (fields) and semantic (match_documents) paths to documents in this container only.
export function ContainerQueryPanel({ container }: ContainerQueryPanelProps) {
  const [query, setQuery] = useState("");
  const { mutate, data, isPending, isError, error } = useRunQuery();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    mutate({ query: query.trim(), containerId: container.id });
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
