import { PlusIcon } from "lucide-react";

interface NewContainerCardProps {
  onClick: () => void;
}

export function NewContainerCard({ onClick }: NewContainerCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[152px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/5 hover:text-foreground"
    >
      <PlusIcon className="size-5" />
      <span className="text-sm">New container</span>
    </button>
  );
}
