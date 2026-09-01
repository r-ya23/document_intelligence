import { useMemo, useState } from "react";
import { useContainers, useAllExtractions } from "@/features/containers/use-containers";
import { ContainerCard } from "@/components/containers/container-card";
import { NewContainerCard } from "@/components/containers/new-container-card";
import { NewContainerDialog } from "@/components/containers/new-container-dialog";
import { TrendingUpIcon, ZapIcon, CheckCircle2Icon } from "lucide-react";

// ── Stat card (Stitch "Editorial Intelligence" design) ────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconHighlight = false,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: typeof TrendingUpIcon;
  iconHighlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-5"
      style={{ background: "#F5F3EE", border: "1px solid #E5E2DA" }}
    >
      <div className="flex items-start justify-between">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "#9B9B9B", letterSpacing: "0.08em" }}
        >
          {label}
        </span>
        <Icon
          className="size-4 shrink-0"
          style={{ color: iconHighlight ? "#5A7A00" : "#B8B4AC" }}
        />
      </div>
      <div>
        <p
          className="text-4xl font-semibold leading-none tracking-tight"
          style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}
        >
          {value}
        </p>
        <p className="mt-1.5 text-[13px]" style={{ color: "#6B6B6B" }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────
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

  const totalDocs = Array.from(statsByContainer.values()).reduce((s, v) => s + v.docCount, 0);
  const totalExtractions = extractions.length;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-semibold leading-tight"
            style={{ color: "#1A1A1A", letterSpacing: "-0.01em" }}
          >
            Your Containers
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "#6B6B6B" }}>
            Each container holds one kind of document — its extractions, its fields, its own query.
          </p>
        </div>
        {/* Ink-black primary CTA */}
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
          style={{ background: "#1A1A1A" }}
        >
          + New Container
        </button>
      </div>

      {/* ── Analytics stats row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Documents"
          value={totalDocs}
          sub={`across ${containers.length} container${containers.length !== 1 ? "s" : ""}`}
          icon={TrendingUpIcon}
        />
        <StatCard
          label="Extractions"
          value={totalExtractions}
          sub="batches processed"
          icon={ZapIcon}
        />
        <StatCard
          label="Pending Review"
          value={0}
          sub="all fields verified"
          icon={CheckCircle2Icon}
          iconHighlight
        />
      </div>

      {/* ── Container grid ──────────────────────────────────────────────── */}
      <div>
        <p
          className="mb-4 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "#9B9B9B", letterSpacing: "0.08em" }}
        >
          Containers
        </p>
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
      </div>

      <NewContainerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
