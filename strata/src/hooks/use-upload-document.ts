import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DOCUMENTS_QUERY_KEY } from "./use-documents";

// Files supported by extract-and-structure today (see supabase/functions/extract-and-structure).
// PDF is intentionally excluded — the edge function rejects it until a text-extraction step is
// added (see decisions.md).
export const ACCEPTED_FILE_EXTENSIONS = ["txt", "md", "csv", "json", "png", "jpg", "jpeg", "webp", "gif", "pdf"];

export function isAcceptedFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ACCEPTED_FILE_EXTENSIONS.includes(ext);
}

interface UploadDocumentInput {
  file: File;
}

async function uploadDocument({ file }: UploadDocumentInput) {
  if (!isAcceptedFile(file.name)) {
    throw new Error(
      `Unsupported file type. Accepted: ${ACCEPTED_FILE_EXTENSIONS.join(", ")}`,
    );
  }

  const storagePath = `${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { contentType: file.type || undefined });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data, error: insertError } = await supabase
    .from("documents")
    .insert({ name: file.name, storage_path: storagePath, status: "queued" })
    .select()
    .single();

  if (insertError) {
    // Best-effort cleanup: don't leave an orphaned file in storage if the row insert failed.
    await supabase.storage.from("documents").remove([storagePath]);
    throw new Error(`Failed to create document record: ${insertError.message}`);
  }

  return data;
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });
}
