import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/types/db";

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  queued: { label: "Queued", variant: "outline" },
  extracting: { label: "Extracting…", variant: "secondary" },
  structuring: { label: "Structuring…", variant: "secondary" },
  ready_for_review: { label: "Ready for review", variant: "default" },
  verified: { label: "Verified", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
