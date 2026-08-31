import type { VerifyMode } from "@/features/containers/types";

export type WizardStepNumber = 1 | 2 | 3 | 4;

export interface WizardState {
  step: WizardStepNumber;
  verifyMode: VerifyMode;
  file: File | null;
  /** Set once the file is actually uploaded to Supabase Storage + `documents` row created. */
  documentId: string | null;
  /** True while step 1's "Start extraction" action is in flight (upload + trigger). */
  starting: boolean;
}

export const INITIAL_WIZARD_STATE = (verifyMode: VerifyMode): WizardState => ({
  step: 1,
  verifyMode,
  file: null,
  documentId: null,
  starting: false,
});
