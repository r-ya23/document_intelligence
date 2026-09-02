import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "@/components/confidence-badge";

describe("ConfidenceBadge", () => {
  it("renders 'Needs review' text for confidence='review'", () => {
    render(<ConfidenceBadge confidence="review" />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });

  it("renders 'High confidence' text for confidence='high'", () => {
    render(<ConfidenceBadge confidence="high" />);
    expect(screen.getByText("High confidence")).toBeInTheDocument();
  });

  it("does NOT render 'High confidence' when confidence is 'review'", () => {
    render(<ConfidenceBadge confidence="review" />);
    expect(screen.queryByText("High confidence")).not.toBeInTheDocument();
  });

  it("does NOT render 'Needs review' when confidence is 'high'", () => {
    render(<ConfidenceBadge confidence="high" />);
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
  });
});
