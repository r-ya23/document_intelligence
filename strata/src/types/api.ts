// Request/response contracts for the two Edge Functions. Mirrors
// supabase/functions/extract-and-structure/index.ts and supabase/functions/query-router/index.ts
// exactly — update both sides together if the function's shape changes.
import type { DocumentStatus, FieldConfidence, FieldType, MatchDocumentsResult } from "./db";

// ---- extract-and-structure ----

// container_id is read from the document row server-side, so it isn't part of the request.
export interface ExtractRequest {
  document_id: string;
}

export interface ExtractedFieldResult {
  label: string;
  value: string;
  source_span: string | null;
  confidence: FieldConfidence;
  field_type: FieldType;
  // false when the field was surfaced outside the container schema (loose-with-flagging)
  is_schema_field: boolean;
}

export interface ExtractResponseSuccess {
  status: "ready_for_review";
  fields: ExtractedFieldResult[];
}

export interface ExtractResponseFailure {
  status: "failed";
  error: string;
}

export type ExtractResponse = ExtractResponseSuccess | ExtractResponseFailure;

// ---- query-router ----

export type QueryFilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";

export interface QueryFilter {
  field: string;
  op: QueryFilterOp;
  value: string;
}

export interface QueryRequest {
  query: string;
  // optional: scope both search modes to a single container. omit for global search.
  container_id?: string | null;
}

export interface FilterModeResultField {
  document_id: string;
  label: string;
  value: string | null;
  confidence: FieldConfidence;
}

export interface FilterModeResult {
  id: string;
  name: string;
  doc_type: string | null;
  status: DocumentStatus;
  created_at: string;
  // provenance: which container this document belongs to (null for uncontained)
  container_id: string | null;
  fields: FilterModeResultField[];
}

export interface FilterModeResponse {
  mode: "filter";
  filters: QueryFilter[];
  results: FilterModeResult[];
}

export interface SemanticModeResponse {
  mode: "semantic";
  results: MatchDocumentsResult[];
}

export type QueryResponse = FilterModeResponse | SemanticModeResponse;

export interface ApiErrorResponse {
  error: string;
}
