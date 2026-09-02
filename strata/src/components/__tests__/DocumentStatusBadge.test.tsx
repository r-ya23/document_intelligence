import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import type { DocumentStatus } from "@/types/db";

const STATUS_LABELS: Record<DocumentStatus, string> = {
  queued: "Queued",
  extracting: "Extracting…",
  structuring: "Structuring…",
  ready_for_review: "Ready for review",
  verified: "Verified",
  failed: "Failed",
};

describe("DocumentStatusBadge", () => {
  it.each(Object.entries(STATUS_LABELS) as [DocumentStatus, string][])(
    "renders the correct label '%s' for status '%s'",
    (status, expectedLabel) => {
      render(<DocumentStatusBadge status={status} />);
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    },
  );

  it("does not render another status's label (no cross-contamination)", () => {
    render(<DocumentStatusBadge status="queued" />);
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });
});
