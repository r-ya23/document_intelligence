import { useMemo, useState } from "react";
import { useContainers, useAllExtractions } from "@/features/containers/use-containers";
import { ContainerCard } from "@/components/containers/container-card";
import { NewContainerCard } from "@/components/containers/new-container-card";
import { NewContainerDialog } from "@/components/containers/new-container-dialog";

export function ContainerDashboardPage() {
  const containers = useContainers();
  const extractions = useAllExtractions();
  const [dialogOpen, setDialogOpen] = useState(false);

  const statsByContainer = useMemo(() => {
    const stats = new Map<string, { docCount: number; extractionCount: number }>();
    for (const extraction of extractions) {
      const current = stats.get(extraction.containerId) ?? { docCount: 0, extractionCount: 0 };
      current.docCount += extraction.docCount;
      current.extractionCount += 1;
      stats.set(extraction.containerId, current);
    }
    return stats;
  }, [extractions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Your containers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each container holds one kind of document — its extractions, its fields, its own query.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {containers.map((container) => {
          const stats = statsByContainer.get(container.id) ?? {
            docCount: 0,
            extractionCount: 0,
          };
          return (
            <ContainerCard
              key={container.id}
              container={container}
              docCount={stats.docCount}
              extractionCount={stats.extractionCount}
            />
          );
        })}
        <NewContainerCard onClick={() => setDialogOpen(true)} />
      </div>

      <NewContainerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
