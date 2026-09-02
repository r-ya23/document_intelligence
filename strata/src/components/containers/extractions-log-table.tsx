import { FileTextIcon, ScrollTextIcon, UserRoundIcon, FilesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Extraction } from "@/features/containers/types";
import type { DocType } from "@/types/db";

const DOC_TYPE_ICON: Record<DocType, typeof FileTextIcon> = {
  invoice: FileTextIcon,
  contract: ScrollTextIcon,
  resume: UserRoundIcon,
  other: FilesIcon,
};

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

interface ExtractionsLogTableProps {
  extractions: Extraction[];
  docType: DocType;
}

export function ExtractionsLogTable({ extractions, docType }: ExtractionsLogTableProps) {
  const Icon = DOC_TYPE_ICON[docType];

  if (extractions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        No extractions yet — click "New extraction" to add your first batch of documents.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      {extractions.map((extraction, i) => (
        <div
          key={extraction.id}
          className={cn(
            "flex items-center gap-4 px-5 py-4",
            i !== extractions.length - 1 && "border-b",
          )}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{extraction.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatRelativeDate(extraction.createdAt)}
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {extraction.docCount} docs
          </span>
          <Badge
            variant={extraction.status === "failed" ? "destructive" : "secondary"}
            className={cn(
              "shrink-0 capitalize",
              extraction.status === "processing" && "text-muted-foreground",
            )}
          >
            {extraction.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
