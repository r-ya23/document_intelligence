import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  step: number;
  label: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { step: 1, label: "Upload" },
  { step: 2, label: "Extract" },
  { step: 3, label: "Verify" },
  { step: 4, label: "Publish" },
];

interface StepperProps {
  currentStep: number;
  /** Steps skipped entirely (e.g. Verify in auto mode) — shown done but visually de-emphasized. */
  skippedSteps?: number[];
}

export function Stepper({ currentStep, skippedSteps = [] }: StepperProps) {
  return (
    <div className="mx-auto flex max-w-2xl items-center">
      {WIZARD_STEPS.map((item, i) => {
        const isDone = item.step < currentStep;
        const isActive = item.step === currentStep;
        const isSkipped = skippedSteps.includes(item.step);

        return (
          <div key={item.step} className="flex flex-1 items-center gap-2.5">
            <div className="flex flex-1 items-center gap-2.5">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
                  isActive && "border-primary bg-primary/10 text-primary",
                  isDone && "border-emerald-600/50 bg-emerald-600/10 text-emerald-600",
                  !isActive && !isDone && "border-border bg-card text-muted-foreground",
                )}
              >
                {isDone ? <CheckIcon className="size-3.5" /> : item.step}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-xs",
                  isActive && "font-medium text-foreground",
                  isDone && "text-emerald-600",
                  !isActive && !isDone && "text-muted-foreground",
                  isSkipped && "italic opacity-60",
                )}
              >
                {item.label}
                {isSkipped && " (skipped)"}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className="h-px flex-1 bg-border" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
