import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UploadIcon } from "lucide-react";
import { useUploadDocument, ACCEPTED_FILE_EXTENSIONS } from "@/hooks/use-upload-document";

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate, isPending } = useUploadDocument();

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;

    mutate(
      { file },
      {
        onSuccess: (doc) => {
          toast.success(`${doc.name} uploaded`, {
            description: "Queued for extraction.",
          });
        },
        onError: (error) => {
          toast.error("Upload failed", { description: error.message });
        },
      },
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
        onChange={handleFileChange}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={isPending}>
        <UploadIcon className="size-4" />
        {isPending ? "Uploading…" : "Upload document"}
      </Button>
    </>
  );
}
