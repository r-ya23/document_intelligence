import { Link } from "react-router-dom";
import { FileTextIcon, ScrollTextIcon, UserRoundIcon, FilesIcon } from "lucide-react";
import type { Container } from "@/features/containers/types";
import type { DocType } from "@/types/db";

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
    <Link to={`/containers/${container.id}`} className="group block h-full">
      <div
        className="flex h-full flex-col gap-4 rounded-xl bg-white p-5 transition-all"
        style={{ border: "1px solid #E5E2DA" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.border = "1px solid #CCFF01";
          (e.currentTarget as HTMLDivElement).style.background = "#FDFFF5";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.border = "1px solid #E5E2DA";
          (e.currentTarget as HTMLDivElement).style.background = "#FFFFFF";
        }}
      >
        {/* Icon pill + verify mode */}
        <div className="flex items-center justify-between">
          <span
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ background: "#F0FFB0" }}
          >
            <Icon className="size-4" style={{ color: "#5A7A00" }} />
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-medium"
            style={
              container.defaultMode === "auto"
                ? { background: "#F0FFB0", color: "#5A7A00", border: "1px solid #CCFF01" }
                : { background: "#F5F3EE", color: "#6B6B6B", border: "1px solid #E5E2DA" }
            }
          >
            {container.defaultMode} verify
          </span>
        </div>

        {/* Name + type */}
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold" style={{ color: "#1A1A1A" }}>
            {container.name}
          </h3>
          <p className="mt-0.5 text-xs capitalize" style={{ color: "#6B6B6B" }}>
            {container.docType} · {docCount} docs
          </p>
        </div>

        {/* Footer */}
        <div
          className="border-t pt-3 text-xs"
          style={{ borderColor: "#E5E2DA", color: "#6B6B6B" }}
        >
          {extractionCount} extraction{extractionCount !== 1 ? "s" : ""}
        </div>
      </div>
    </Link>
  );
}
