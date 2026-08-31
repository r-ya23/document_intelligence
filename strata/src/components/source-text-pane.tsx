import { useMemo } from "react";

interface SourceTextPaneProps {
  rawText: string | null;
  highlightedSpan: string | null;
}

// Splits raw_text into [before, match, after] around the first occurrence of highlightedSpan.
// This is a plain string search, not fuzzy matching — if Claude's source_span doesn't appear
// verbatim in raw_text (e.g. paraphrased), the highlight silently falls back to no-match rather
// than guessing. Good enough for the plain-text path; see decisions.md for the scope boundary
// around image/PDF source-span highlighting (not attempted here).
function splitAroundSpan(text: string, span: string | null) {
  if (!span) return { before: text, match: "", after: "" };
  const index = text.indexOf(span);
  if (index === -1) return { before: text, match: "", after: "" };
  return {
    before: text.slice(0, index),
    match: text.slice(index, index + span.length),
    after: text.slice(index + span.length),
  };
}

export function SourceTextPane({ rawText, highlightedSpan }: SourceTextPaneProps) {
  const { before, match, after } = useMemo(
    () => splitAroundSpan(rawText ?? "", highlightedSpan),
    [rawText, highlightedSpan],
  );

  if (!rawText) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed p-8 text-sm text-muted-foreground">
        No source text available for this document.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto rounded-md border p-4">
      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
        {before}
        {match && (
          <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-500/40">{match}</mark>
        )}
        {after}
      </pre>
    </div>
  );
}
