import { useMemo, useState } from "react";
import { useContainers, useAllExtractions } from "@/features/containers/use-containers";
import { ContainerCard } from "@/components/containers/container-card";
import { NewContainerCard } from "@/components/containers/new-container-card";
import { NewContainerDialog } from "@/components/containers/new-container-dialog";
import { TrendingUpIcon, ZapIcon, CheckCircle2Icon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useTheme } from "@/lib/theme";

// How many container cards to show before "View more" reveals the rest.
const COLLAPSED_CARD_COUNT = 6;

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconHighlight = false,
  dark,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: typeof TrendingUpIcon;
  iconHighlight?: boolean;
  dark: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-5 transition-colors duration-200"
      style={{
        background: dark ? "#1C2128" : "#FFFFFF",
        border: `1px solid ${dark ? "#30363D" : "#E5E7EB"}`,
        boxShadow: dark
          ? "none"
          : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-start justify-between">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: dark ? "#8B949E" : "#9CA3AF", letterSpacing: "0.08em" }}
        >
          {label}
        </span>
        <Icon
          className="size-4 shrink-0"
          style={{ color: iconHighlight ? "#CCFF01" : dark ? "#8B949E" : "#9CA3AF" }}
        />
      </div>
      <div>
        <p
          className="text-4xl font-semibold leading-none tracking-tight"
          style={{ color: dark ? "#F0F6FC" : "#111827", letterSpacing: "-0.02em" }}
        >
          {value}
        </p>
        <p className="mt-1.5 text-[13px]" style={{ color: dark ? "#8B949E" : "#6B7280" }}>
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
  const [expanded, setExpanded] = useState(false);
  const { theme } = useTheme();
  const dark = theme === "dark";

  // Collapse the grid to the first N cards; "View more" reveals the rest. The New Container card
  // always shows, so it sits after whatever slice is visible.
  const canCollapse = containers.length > COLLAPSED_CARD_COUNT;
  const visibleContainers =
    canCollapse && !expanded ? containers.slice(0, COLLAPSED_CARD_COUNT) : containers;

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
            style={{ color: dark ? "#F0F6FC" : "#111827", letterSpacing: "-0.01em" }}
          >
            Your Containers
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: dark ? "#8B949E" : "#6B7280" }}>
            Each container holds one kind of document — its extractions, its fields, its own query.
          </p>
        </div>
        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{
            background: dark ? "#CCFF01" : "#111827",
            color: dark ? "#0F1117" : "#FFFFFF",
          }}
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
          dark={dark}
        />
        <StatCard
          label="Extractions"
          value={totalExtractions}
          sub="batches processed"
          icon={ZapIcon}
          dark={dark}
        />
        <StatCard
          label="Pending Review"
          value={0}
          sub="all fields verified"
          icon={CheckCircle2Icon}
          iconHighlight
          dark={dark}
        />
      </div>

      {/* ── Container grid ──────────────────────────────────────────────── */}
      <div>
        <p
          className="mb-4 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: dark ? "#8B949E" : "#9CA3AF", letterSpacing: "0.08em" }}
        >
          Containers
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleContainers.map((container) => {
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

        {/* View more / less — only when there are more containers than the collapsed limit. */}
        {canCollapse && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              style={{
                borderColor: dark ? "#30363D" : "#E5E7EB",
                color: dark ? "#8B949E" : "#6B7280",
                background: dark ? "#161B22" : "#FFFFFF",
              }}
            >
              {expanded ? (
                <>
                  Show less
                  <ChevronUpIcon className="size-4" />
                </>
              ) : (
                <>
                  View {containers.length - COLLAPSED_CARD_COUNT} more
                  <ChevronDownIcon className="size-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <NewContainerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
