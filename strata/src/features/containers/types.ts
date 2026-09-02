// Container/extraction view models used across the container pages. These are camelCase shapes
// the UI consumes; use-containers.ts maps the snake_case Supabase rows (containers,
// container_fields, documents) into them. Kept separate from src/types/db.ts (the raw DB-derived
// types) so it's clear which is the UI model vs the schema shape.
import type { DocType, FieldType } from "@/types/db";

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
// pretending it published; "processing" covers the in-flight statuses.
export type ExtractionStatus = "published" | "failed" | "processing";

export interface Extraction {
  id: string;
  containerId: string;
  label: string;
  docCount: number;
  createdAt: string;
  status: ExtractionStatus;
  /** Real Supabase document ids behind this extraction, for linking into /documents/:id. */
  documentIds: string[];
}

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
