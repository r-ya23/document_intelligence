import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
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
import { useCreateContainer } from "@/features/containers/use-containers";
import type { ContainerFieldInput, VerifyMode } from "@/features/containers/types";
import type { DocType, FieldType } from "@/types/db";

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

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
];

// Starter schema per doc type so the dialog opens with a sensible, editable set of fields
// instead of a blank slate — this is what makes a container a typed dataset, not a folder.
const STARTER_SCHEMA: Record<DocType, ContainerFieldInput[]> = {
  invoice: [
    { label: "vendor", fieldType: "text", required: true },
    { label: "invoice_number", fieldType: "text", required: false },
    { label: "total_due", fieldType: "currency", required: true },
    { label: "due_date", fieldType: "date", required: false },
  ],
  contract: [
    { label: "party_a", fieldType: "text", required: true },
    { label: "party_b", fieldType: "text", required: true },
    { label: "effective_date", fieldType: "date", required: false },
    { label: "term_length", fieldType: "text", required: false },
  ],
  resume: [
    { label: "full_name", fieldType: "text", required: true },
    { label: "email", fieldType: "text", required: false },
    { label: "years_experience", fieldType: "number", required: false },
  ],
  other: [{ label: "title", fieldType: "text", required: false }],
};

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
  const { mutateAsync: createContainer, isPending } = useCreateContainer();
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<DocType>("invoice");
  const [defaultMode, setDefaultMode] = useState<VerifyMode>("auto");
  const [fields, setFields] = useState<ContainerFieldInput[]>(STARTER_SCHEMA.invoice);

  function reset() {
    setName("");
    setDocType("invoice");
    setDefaultMode("auto");
    setFields(STARTER_SCHEMA.invoice);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  // Swapping doc type reseeds the schema with that type's starter fields (only if the user
  // hasn't diverged — keep it simple: always reseed, since they can still edit afterwards).
  function handleDocTypeChange(next: DocType) {
    setDocType(next);
    setFields(STARTER_SCHEMA[next]);
  }

  function updateField(index: number, patch: Partial<ContainerFieldInput>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addField() {
    setFields((prev) => [...prev, { label: "", fieldType: "text", required: false }]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const container = await createContainer({
        name: trimmed,
        docType,
        defaultMode,
        fields,
      });
      handleOpenChange(false);
      navigate(`/containers/${container.id}`);
    } catch (error) {
      toast.error("Couldn't create container", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fields are optional: a container with no schema falls back to open-ended extraction
  // (the edge function detects zero container_fields and lets the model choose labels).

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a container</DialogTitle>
          <DialogDescription>
            A container groups documents of one kind. Optionally define a field schema so every
            document conforms to it — leave it empty to let extraction choose fields automatically.
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
            />
          </div>

          <div className="space-y-1.5">
            <Label>Document type</Label>
            <ChipRow options={DOC_TYPE_OPTIONS} value={docType} onChange={handleDocTypeChange} />
          </div>

          <div className="space-y-1.5">
            <Label>Default verification mode</Label>
            <ChipRow
              options={VERIFY_MODE_OPTIONS}
              value={defaultMode}
              onChange={setDefaultMode}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Field schema <span className="text-muted-foreground">(optional)</span></Label>
              <Button type="button" variant="ghost" size="sm" onClick={addField}>
                <PlusIcon className="size-3.5" />
                Add field
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    placeholder="field_label"
                    className="flex-1 font-mono text-xs"
                    aria-label={`Field ${index + 1} label`}
                  />
                  <select
                    value={field.fieldType}
                    onChange={(e) =>
                      updateField(index, { fieldType: e.target.value as FieldType })
                    }
                    className="rounded-md border border-border bg-background px-2 py-2 text-xs"
                    aria-label={`Field ${index + 1} type`}
                  >
                    {FIELD_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => updateField(index, { required: !field.required })}
                    className={cn(
                      "rounded-md border px-2 py-2 text-xs transition-colors",
                      field.required
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={field.required}
                    title="Toggle required"
                  >
                    Req
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(index)}
                    aria-label={`Remove field ${index + 1}`}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No schema defined — extraction will pick fields automatically. Add fields to
                  make every document conform to a fixed shape.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isPending}>
            {isPending ? "Creating…" : "Create container"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
