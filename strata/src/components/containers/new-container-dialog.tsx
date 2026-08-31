import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { containerStore } from "@/features/containers/use-containers";
import type { VerifyMode } from "@/features/containers/types";
import type { DocType } from "@/types/db";

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: "invoice", label: "Invoice" },
  { value: "contract", label: "Contract" },
  { value: "resume", label: "Resume" },
  { value: "other", label: "Other" },
];

const VERIFY_MODE_OPTIONS: { value: VerifyMode; label: string }[] = [
  { value: "auto", label: "Auto verify" },
  { value: "manual", label: "Manual verify" },
];

interface NewContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Radio-chip style buttons (not a <select>) for doc type + verify mode — matches the design
// mockup's own pattern, and the codebase doesn't have a shadcn Select component yet.
function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-center text-xs transition-colors",
            value === opt.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function NewContainerDialog({ open, onOpenChange }: NewContainerDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<DocType>("invoice");
  const [defaultMode, setDefaultMode] = useState<VerifyMode>("auto");

  function reset() {
    setName("");
    setDocType("invoice");
    setDefaultMode("auto");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const container = containerStore.createContainer({
      name: trimmed,
      docType,
      defaultMode,
    });
    handleOpenChange(false);
    navigate(`/containers/${container.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a container</DialogTitle>
          <DialogDescription>
            Group documents of the same kind together — invoices, resumes, contracts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-container-name">Container name</Label>
            <Input
              id="new-container-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vendor invoices"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Document type</Label>
            <ChipRow options={DOC_TYPE_OPTIONS} value={docType} onChange={setDocType} />
          </div>

          <div className="space-y-1.5">
            <Label>Default verification mode</Label>
            <ChipRow
              options={VERIFY_MODE_OPTIONS}
              value={defaultMode}
              onChange={setDefaultMode}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create container
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
