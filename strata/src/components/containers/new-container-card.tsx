import { PlusIcon } from "lucide-react";
import { useTheme } from "@/lib/theme";

interface NewContainerCardProps {
  onClick: () => void;
}

export function NewContainerCard({ onClick }: NewContainerCardProps) {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-xl transition-all duration-150"
      style={{
        background: "transparent",
        border: `1px dashed ${dark ? "#30363D" : "#D0CEC8"}`,
        color: dark ? "#8B949E" : "#9B9B9B",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.border = "1px dashed #CCFF01";
        el.style.color = dark ? "#CCFF01" : "#5A7A00";
        el.style.background = dark ? "rgba(204,255,1,0.05)" : "#FDFFF5";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.border = `1px dashed ${dark ? "#30363D" : "#D0CEC8"}`;
        el.style.color = dark ? "#8B949E" : "#9B9B9B";
        el.style.background = "transparent";
      }}
    >
      <PlusIcon className="size-5" />
      <span className="text-sm font-medium">New container</span>
    </button>
  );
}
