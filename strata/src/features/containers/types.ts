// UI-only container/extraction model — mirrors the "containers" concept from the design mockup.
// Not backed by Supabase yet: no `containers` or `extractions` tables exist. This module is the
// single source of truth for that mock state, kept separate from src/types/db.ts (the real,
// DB-backed types) so it's obvious which types are provisional vs schema-derived.
import type { DocType } from "@/types/db";

export type VerifyMode = "auto" | "manual";

export interface Container {
  id: string;
  name: string;
  docType: DocType;
  defaultMode: VerifyMode;
  createdAt: string;
}

// An extraction's status mirrors the underlying document's real status (see use-containers.ts,
// docToExtraction). "published" is a UI label for a document that finished successfully
// (ready_for_review / verified); "failed" surfaces a failed extraction in the log rather than
// pretending it published.
export type ExtractionStatus = "published" | "failed" | "processing";

export interface Extraction {
  id: string;
  containerId: string;
  label: string;
  docCount: number;
  createdAt: string;
  status: ExtractionStatus;
  /** Real Supabase document ids produced by this extraction batch, for linking into /documents/:id. */
  documentIds: string[];
}

import type { FieldType } from "@/types/db";

// One field in a container's schema, as authored in the create dialog. Mirrors container_fields.
export interface ContainerFieldInput {
  label: string;
  fieldType: FieldType;
  required: boolean;
  description?: string | null;
}

export interface NewContainerInput {
  name: string;
  docType: DocType;
  defaultMode: VerifyMode;
  fields: ContainerFieldInput[];
}

export interface NewExtractionInput {
  containerId: string;
  docCount: number;
  mode: VerifyMode;
  documentIds: string[];
}
