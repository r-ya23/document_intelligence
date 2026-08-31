import { UploadButton } from "@/components/upload-button";
import { DocumentList } from "@/components/document-list";

export function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documents</h1>
        <UploadButton />
      </div>
      <DocumentList />
    </div>
  );
}
