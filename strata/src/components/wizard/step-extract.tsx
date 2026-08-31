import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { DocumentRow, DocumentStatus } from "@/types/db";

interface StepExtractProps {
  fileName: string;
  document: DocumentRow | undefined;
  errorMessage: string | null;
}

const STATUS_LINE: Record<DocumentStatus, string> = {
  queued: "queued for extraction",
  extracting: "reading document…",
  structuring: "mapping fields to schema…",
  ready_for_review: "extraction complete ✓",
  verified: "extraction complete ✓",
  failed: "extraction failed",
};

// Real progress driven by the document's actual `status` column (via useDocument's Realtime
// subscription) — not a simulated timer. Each status transition appends one line to the feed and
// bumps the progress bar; there's no fine-grained progress within a single status from the API,
// so the mapping below is a fixed step per status rather than a continuous percentage.
const STATUS_PROGRESS: Record<DocumentStatus, number> = {
  queued: 10,
  extracting: 45,
  structuring: 75,
  ready_for_review: 100,
  verified: 100,
  failed: 100,
};

export function StepExtract({ fileName, document, errorMessage }: StepExtractProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => {
    const collected: { text: string; ok: boolean }[] = [];
    collected.push({ text: `reading ${fileName} …`, ok: false });
    if (document) {
      const order: DocumentStatus[] = ["queued", "extracting", "structuring", "ready_for_review"];
      for (const status of order) {
        const reached =
          document.status === status ||
          (status === "queued" && document.status !== "queued") ||
          (status === "extracting" &&
            ["structuring", "ready_for_review", "verified"].includes(document.status)) ||
          (status === "structuring" && ["ready_for_review", "verified"].includes(document.status));
        if (reached) {
          collected.push({
            text: STATUS_LINE[status],
            ok: status === "ready_for_review",
          });
        }
      }
      if (document.status === "failed") {
        collected.push({ text: STATUS_LINE.failed, ok: false });
      }
    }
    return collected;
  }, [document, fileName]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const status = document?.status ?? "queued";
  const progress = errorMessage ? 100 : STATUS_PROGRESS[status];
  const isDone = status === "ready_for_review" || status === "verified";
  const isFailed = status === "failed" || !!errorMessage;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-semibold">
          {!isDone && !isFailed && (
            <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary" />
          )}
          {isFailed ? "Extraction failed" : isDone ? "Extraction complete" : "Reading & structuring"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isFailed
            ? errorMessage ?? "Something went wrong during extraction."
            : isDone
              ? "Fields have been structured from your document."
              : "Strata is extracting fields from your document."}
        </p>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-500", isFailed ? "bg-destructive" : "bg-primary")}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        ref={terminalRef}
        className="h-52 overflow-y-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed"
      >
        {lines.map((line, i) => (
          <div key={i} className={line.ok ? "text-emerald-600" : "text-muted-foreground"}>
            <span className="mr-2 text-primary">&gt;</span>
            {line.text}
          </div>
        ))}
        {errorMessage && (
          <div className="text-destructive">
            <span className="mr-2 text-primary">&gt;</span>
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
