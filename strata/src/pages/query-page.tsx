import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchIcon } from "lucide-react";
import { useRunQuery } from "@/hooks/use-run-query";
import { QueryResults } from "@/components/query-results";

export function QueryPage() {
  const [query, setQuery] = useState("");
  const { mutate, data, isPending, isError, error } = useRunQuery();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    // no containerId -> global search across all documents
    mutate({ query: query.trim() });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Query</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask a question in plain language — structured filters and semantic search are both
          handled automatically.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. invoices with total_due greater than 500"
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
          <p className="mt-2 italic">"invoices with total_due greater than 500"</p>
          <p className="mt-1 italic">"contracts about liability"</p>
        </div>
      )}
    </div>
  );
}
