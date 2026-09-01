import { PlusIcon } from "lucide-react";

interface NewContainerCardProps {
  onClick: () => void;
}

export function NewContainerCard({ onClick }: NewContainerCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-xl transition-all"
      style={{
        background: "transparent",
        border: "1px dashed #D0CEC8",
        color: "#9B9B9B",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.border = "1px dashed #CCFF01";
        (e.currentTarget as HTMLButtonElement).style.color = "#5A7A00";
        (e.currentTarget as HTMLButtonElement).style.background = "#FDFFF5";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.border = "1px dashed #D0CEC8";
        (e.currentTarget as HTMLButtonElement).style.color = "#9B9B9B";
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <PlusIcon className="size-5" />
      <span className="text-sm font-medium">New container</span>
    </button>
  );
}
