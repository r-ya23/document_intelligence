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

export type ExtractionStatus = "published";

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

export interface NewContainerInput {
  name: string;
  docType: DocType;
  defaultMode: VerifyMode;
}

export interface NewExtractionInput {
  containerId: string;
  docCount: number;
  mode: VerifyMode;
  documentIds: string[];
}
