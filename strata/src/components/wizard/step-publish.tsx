import { Button } from "@/components/ui/button";
import { CheckIcon } from "lucide-react";
import type { VerifyMode } from "@/features/containers/types";

interface StepPublishProps {
  containerName: string;
  fileName: string;
  fieldCount: number;
  verifiedCount: number;
  verifyMode: VerifyMode;
  isPublishing: boolean;
  isPublished: boolean;
  onBackToContainer: () => void;
  onQueryContainer: () => void;
}

export function StepPublish({
  containerName,
  fileName,
  fieldCount,
  verifiedCount,
  verifyMode,
  isPublishing,
  isPublished,
  onBackToContainer,
  onQueryContainer,
}: StepPublishProps) {
  if (isPublished) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600">
          <CheckIcon className="size-6" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Published</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Added to "{containerName}" and ready to query.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={onBackToContainer}>
            Back to container
          </Button>
          <Button onClick={onQueryContainer}>Query this container →</Button>
        </div>
      </div>
    );
  }

  if (isPublishing) {
    return (
      <div className="py-10 text-center">
        <span className="mx-auto block size-8 animate-spin rounded-full border-3 border-border border-t-primary" />
        <h2 className="mt-5 text-base font-semibold">Publishing…</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Adding this document to the container and indexing for search.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Publish to container</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This document will become part of the container and be queryable immediately.
        </p>
      </div>

      <div className="divide-y rounded-xl border">
        <SummaryRow label="Container" value={containerName} />
        <SummaryRow label="Document" value={fileName} />
        <SummaryRow label="Fields extracted" value={String(fieldCount)} />
        <SummaryRow label="Verified" value={`${verifiedCount} / ${fieldCount}`} />
        <SummaryRow label="Verification mode" value={verifyMode === "auto" ? "Auto verify" : "Manual verify"} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
