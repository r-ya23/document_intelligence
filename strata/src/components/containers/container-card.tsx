import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { FileTextIcon, ScrollTextIcon, UserRoundIcon, FilesIcon } from "lucide-react";
import type { Container } from "@/features/containers/types";
import type { DocType } from "@/types/db";

// Styles live alongside the component (Tailwind utility classes, matching the rest of the
// codebase) rather than a separate stylesheet — see other components under src/components.
const DOC_TYPE_ICON: Record<DocType, typeof FileTextIcon> = {
  invoice: FileTextIcon,
  contract: ScrollTextIcon,
  resume: UserRoundIcon,
  other: FilesIcon,
};

interface ContainerCardProps {
  container: Container;
  docCount: number;
  extractionCount: number;
}

export function ContainerCard({ container, docCount, extractionCount }: ContainerCardProps) {
  const Icon = DOC_TYPE_ICON[container.docType];

  return (
    <Link to={`/containers/${container.id}`}>
      <Card className="h-full gap-3 py-5 transition-colors hover:border-primary/40">
        <CardContent className="flex h-full flex-col gap-3 px-5">
          <Icon className="size-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold">{container.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">
              {container.docType} · default {container.defaultMode} verify
            </p>
          </div>
          <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>{docCount} documents</span>
            <span>
              {extractionCount} extraction{extractionCount !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
