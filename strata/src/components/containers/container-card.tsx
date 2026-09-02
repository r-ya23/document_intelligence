import { Link } from "react-router-dom";
import { FileTextIcon, ScrollTextIcon, UserRoundIcon, FilesIcon } from "lucide-react";
import type { Container } from "@/features/containers/types";
import type { DocType } from "@/types/db";
import { useTheme } from "@/lib/theme";

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
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <Link to={`/containers/${container.id}`} className="group block h-full">
      <div
        className="flex h-full flex-col gap-4 rounded-xl p-5 transition-all duration-150"
        style={{
          background: dark ? "#1C2128" : "#FFFFFF",
          border: `1px solid ${dark ? "#30363D" : "#E5E7EB"}`,
          boxShadow: dark
            ? "none"
            : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.border = "1px solid #CCFF01";
          el.style.background = dark ? "#1E2A1A" : "#FDFFF5";
          el.style.boxShadow = dark
            ? "0 0 0 1px rgba(204,255,1,0.2)"
            : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(204,255,1,0.12)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.border = `1px solid ${dark ? "#30363D" : "#E5E7EB"}`;
          el.style.background = dark ? "#1C2128" : "#FFFFFF";
          el.style.boxShadow = dark
            ? "none"
            : "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)";
        }}
      >
        {/* Icon pill + verify mode */}
        <div className="flex items-center justify-between">
          <span
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ background: dark ? "rgba(204,255,1,0.12)" : "#F0FFB0" }}
          >
            <Icon className="size-4" style={{ color: dark ? "#CCFF01" : "#5A7A00" }} />
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-medium"
            style={
              container.defaultMode === "auto"
                ? {
                    background: dark ? "rgba(204,255,1,0.1)" : "#F0FFB0",
                    color: dark ? "#CCFF01" : "#5A7A00",
                    border: `1px solid ${dark ? "rgba(204,255,1,0.3)" : "#CCFF01"}`,
                  }
                : {
                    background: dark ? "#21262D" : "#F5F3EE",
                    color: dark ? "#8B949E" : "#6B6B6B",
                    border: `1px solid ${dark ? "#30363D" : "#E5E2DA"}`,
                  }
            }
          >
            {container.defaultMode} verify
          </span>
        </div>

        {/* Name + type */}
        <div className="flex-1">
          <h3
            className="text-[15px] font-semibold"
            style={{ color: dark ? "#F0F6FC" : "#111827" }}
          >
            {container.name}
          </h3>
          <p
            className="mt-0.5 text-xs capitalize"
            style={{ color: dark ? "#8B949E" : "#6B7280" }}
          >
            {container.docType} · {docCount} docs
          </p>
        </div>

        {/* Footer */}
        <div
          className="border-t pt-3 text-xs"
          style={{
            borderColor: dark ? "#30363D" : "#E5E7EB",
            color: dark ? "#8B949E" : "#6B7280",
          }}
        >
          {extractionCount} extraction{extractionCount !== 1 ? "s" : ""}
        </div>
      </div>
    </Link>
  );
}
