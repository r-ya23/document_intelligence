import { Badge } from "@/components/ui/badge";
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import type { FieldConfidence } from "@/types/db";

// Icon + text, not color alone — color-blind users and dark/light theme variance shouldn't be the
// only signal distinguishing "trust this" from "check this".
export function ConfidenceBadge({ confidence }: { confidence: FieldConfidence }) {
  if (confidence === "review") {
    return (
      <Badge variant="destructive">
        <TriangleAlertIcon className="size-3" />
        Needs review
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <CircleCheckIcon className="size-3" />
      High confidence
    </Badge>
  );
}
