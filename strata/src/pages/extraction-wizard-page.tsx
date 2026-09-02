import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/wizard/stepper";
import { StepUpload } from "@/components/wizard/step-upload";
import { StepExtract } from "@/components/wizard/step-extract";
import { StepVerify } from "@/components/wizard/step-verify";
import { StepPublish } from "@/components/wizard/step-publish";
import { useQueryClient } from "@tanstack/react-query";
import { useContainer } from "@/features/containers/use-containers";
import { useUploadDocument } from "@/hooks/use-upload-document";
import { useDocument } from "@/hooks/use-document";
import { useVerifyAllFields } from "@/hooks/use-update-field";
import { isDocumentFullyVerified } from "@/hooks/use-sync-document-verified-status";
import { extractAndStructure } from "@/lib/edge-functions";
import type { VerifyMode } from "@/features/containers/types";
import type { WizardStepNumber } from "@/features/containers/wizard-state";

export function ExtractionWizardPage() {
  const { containerId } = useParams<{ containerId: string }>();
  const container = useContainer(containerId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStepNumber>(1);
  const [verifyMode, setVerifyMode] = useState<VerifyMode>(container?.defaultMode ?? "auto");
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [autoVerifyTriggered, setAutoVerifyTriggered] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const { mutateAsync: uploadDocument } = useUploadDocument();
  const { documentQuery, fieldsQuery } = useDocument(documentId ?? undefined);
  const { mutate: verifyAllFields } = useVerifyAllFields(documentId ?? "");

  const document = documentQuery.data;
  const fields = fieldsQuery.data ?? [];

  // Sync verifyMode to the container's default once it loads (container may not be resolved yet
  // on first render, since useContainer reads from the mock store).
  useEffect(() => {
    if (container) setVerifyMode(container.defaultMode);
  }, [container]);

  // Once extraction reaches ready_for_review: auto mode silently verifies every field and moves
  // straight to publish; manual mode stops here so the user can review.
  useEffect(() => {
    if (step !== 2 || !document) return;
    if (document.status === "ready_for_review" && !autoVerifyTriggered) {
      setAutoVerifyTriggered(true);
      if (verifyMode === "auto") {
        verifyAllFields(undefined, {
          onSuccess: () => setStep(4),
          onError: (error) => {
            toast.error("Auto-verify failed", { description: error.message });
            setStep(3);
          },
        });
      } else {
        setStep(3);
      }
    }
    if (document.status === "failed") {
      // Stay on step 2 — StepExtract shows the error and the user can retry from step 1.
    }
  }, [step, document, verifyMode, autoVerifyTriggered, verifyAllFields]);

  if (!container) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Container not found.</p>
        <Button variant="outline" asChild>
          <Link to="/dashboard">Back to containers</Link>
        </Button>
      </div>
    );
  }

  function handleClose() {
    if (starting || isPublishing) return;
    navigate(`/containers/${container!.id}`);
  }

  async function handleStartExtraction() {
    if (!file) return;
    setStarting(true);
    try {
      const doc = await uploadDocument({ file, containerId: container!.id });
      setDocumentId(doc.id);
      setStep(2);
      await extractAndStructure(doc.id);
    } catch (error) {
      toast.error("Failed to start extraction", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setStarting(false);
    }
  }

  function handlePublish() {
    if (!documentId || !file) return;
    setIsPublishing(true);
    // The document already persists with this container_id and its verified fields, so "publish"
    // is just the final UI transition. Refresh the container's extractions (derived from
    // documents) so the new one shows up when the user returns to the container. The short delay
    // matches the mockup's "indexing" pacing.
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["extractions", container!.id] });
      queryClient.invalidateQueries({ queryKey: ["extractions", "all"] });
      setIsPublishing(false);
      setIsPublished(true);
    }, 900);
  }

  const fieldCount = fields.length;
  const verifiedCount = fields.filter((f) => f.verified).length;
  const canStartExtraction = !!file && !starting;
  const skippedSteps = verifyMode === "auto" ? [3] : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            strata
          </Link>
          <span>/</span>
          <Link to={`/containers/${container.id}`} className="hover:text-foreground">
            {container.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">new extraction</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
          <XIcon className="size-4" />
        </Button>
      </div>

      <Stepper currentStep={step} skippedSteps={skippedSteps} />

      <div className="mx-auto max-w-2xl">
        {step === 1 && (
          <StepUpload
            containerName={container.name}
            containerDefaultMode={container.defaultMode}
            verifyMode={verifyMode}
            file={file}
            onVerifyModeChange={setVerifyMode}
            onFileChange={setFile}
          />
        )}
        {step === 2 && (
          <StepExtract
            fileName={file?.name ?? ""}
            document={document}
            errorMessage={document?.status === "failed" ? document.error_message : null}
          />
        )}
        {step === 3 && documentId && (
          <StepVerify documentId={documentId} fileName={file?.name ?? ""} fields={fields} />
        )}
        {step === 4 && (
          <StepPublish
            containerName={container.name}
            fileName={file?.name ?? ""}
            fieldCount={fieldCount}
            verifiedCount={verifiedCount}
            verifyMode={verifyMode}
            isPublishing={isPublishing}
            isPublished={isPublished}
            onBackToContainer={() => navigate(`/containers/${container.id}`)}
            onQueryContainer={() => navigate(`/containers/${container.id}?tab=query`)}
          />
        )}
      </div>

      {!isPublished && (
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Button
            variant="outline"
            disabled={step === 1 || starting || isPublishing}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as WizardStepNumber) : s))}
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Button>
          <span className="font-mono text-xs text-muted-foreground">Step {step} of 4</span>
          {step === 1 && (
            <Button disabled={!canStartExtraction} onClick={handleStartExtraction}>
              {starting ? "Starting…" : "Start extraction"}
            </Button>
          )}
          {step === 2 && document?.status === "failed" && (
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setDocumentId(null);
                setAutoVerifyTriggered(false);
              }}
            >
              Back to upload
            </Button>
          )}
          {step === 2 && document?.status !== "failed" && (
            <Button disabled>Extracting…</Button>
          )}
          {step === 3 && (
            <Button
              disabled={!isDocumentFullyVerified(fields)}
              onClick={() => setStep(4)}
            >
              Continue to publish
            </Button>
          )}
          {step === 4 && (
            <Button disabled={isPublishing} onClick={handlePublish}>
              {isPublishing ? "Publishing…" : "Publish"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
