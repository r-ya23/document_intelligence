import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { UploadCloudIcon, FileIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_FILE_EXTENSIONS } from "@/hooks/use-upload-document";
import type { VerifyMode } from "@/features/containers/types";

interface ModeOption {
  value: VerifyMode;
  title: string;
  description: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "auto",
    title: "Auto verify",
    description: "Submit and walk away — extraction, verification, and publish run in one go.",
  },
  {
    value: "manual",
    title: "Manual verify",
    description: "Pause after extraction so you can review fields and confirm before publishing.",
  },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface StepUploadProps {
  containerName: string;
  containerDefaultMode: VerifyMode;
  verifyMode: VerifyMode;
  file: File | null;
  onVerifyModeChange: (mode: VerifyMode) => void;
  onFileChange: (file: File | null) => void;
}

export function StepUpload({
  containerName,
  containerDefaultMode,
  verifyMode,
  file,
  onVerifyModeChange,
  onFileChange,
}: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList: FileList | null) {
    const picked = fileList?.[0];
    if (picked) onFileChange(picked);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Upload a document</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adding to "{containerName}". Verification mode defaults to {containerDefaultMode} —
          change it for just this upload if needed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODE_OPTIONS.map((opt) => {
          const selected = verifyMode === opt.value;
          return (
            <Card
              key={opt.value}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => onVerifyModeChange(opt.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onVerifyModeChange(opt.value);
              }}
              className={cn(
                "cursor-pointer gap-2 py-4 transition-colors",
                selected ? "ring-2 ring-primary" : "hover:border-primary/40",
              )}
            >
              <CardContent className="space-y-1.5 px-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {opt.title}
                  </span>
                  <span
                    className={cn(
                      "size-3.5 shrink-0 rounded-full border",
                      selected ? "border-primary bg-primary" : "border-border",
                    )}
                  />
                </div>
                <p className="text-sm font-medium">{opt.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {opt.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {file ? (
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <FileIcon className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Remove file"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "cursor-pointer rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "hover:border-primary/40",
          )}
        >
          <UploadCloudIcon className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Drop a file or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ACCEPTED_FILE_EXTENSIONS.map((ext) => ext.toUpperCase()).join(" · ")}
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
