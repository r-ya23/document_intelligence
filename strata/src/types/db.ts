// Hand-written to match supabase/migrations/*.sql exactly.
//
// Regenerate from the live schema once the project is linked, to guarantee this can never drift:
//   supabase gen types typescript --linked > src/types/db.ts
// (or --local if generating against the local dev stack). Replace this file wholesale when you do.

export type DocumentStatus =
  | "queued"
  | "extracting"
  | "structuring"
  | "ready_for_review"
  | "verified"
  | "failed";

export type FieldConfidence = "high" | "review";

export type DocType = "invoice" | "contract" | "resume" | "other";

// Type of an extracted/schema field — drives query-time casting for filters + aggregates.
export type FieldType = "text" | "number" | "currency" | "date";

export type VerifyMode = "auto" | "manual";

export interface DocumentRow {
  id: string;
  name: string;
  storage_path: string;
  doc_type: DocType | null;
  status: DocumentStatus;
  error_message: string | null;
  raw_text: string | null;
  embedding: number[] | null;
  container_id: string | null;
  created_at: string;
}

export interface FieldRow {
  id: string;
  document_id: string;
  label: string;
  value: string | null;
  source_span: string | null;
  confidence: FieldConfidence;
  verified: boolean;
  field_type: FieldType;
  // false when the model surfaced a field not defined in the container schema (loose-with-flagging)
  is_schema_field: boolean;
  created_at: string;
}

// A container = a persisted, schema-driven dataset (see 20260902000000_containers_schema.sql).
export interface ContainerRow {
  id: string;
  name: string;
  doc_type: DocType | null;
  default_mode: VerifyMode;
  created_at: string;
}

// One row per field a container expects its documents to conform to.
export interface ContainerFieldRow {
  id: string;
  container_id: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  field_id: string;
  old_value: string | null;
  new_value: string | null;
  edited_at: string;
}

export interface MatchDocumentsResult {
  id: string;
  name: string;
  doc_type: DocType | null;
  raw_text: string | null;
  similarity: number;
  // provenance: which container this hit came from (null for uncontained documents)
  container_id: string | null;
  container_name: string | null;
}

// Minimal Supabase `Database` generic shape — enough for the typed client to check
// table/column names and RPC args at compile time without a full generated file.
// Row/Insert/Update must satisfy Record<string, unknown> structurally (index signature),
// hence the `& Record<string, unknown>` intersections below — plain interfaces alone don't
// satisfy postgrest-js's GenericTable constraint.
export interface Database {
  public: {
    Tables: {
      documents: {
        Row: DocumentRow & Record<string, unknown>;
        Insert: Partial<DocumentRow> &
          Pick<DocumentRow, "name" | "storage_path"> &
          Record<string, unknown>;
        Update: Partial<DocumentRow> & Record<string, unknown>;
        Relationships: [];
      };
      fields: {
        Row: FieldRow & Record<string, unknown>;
        Insert: Partial<FieldRow> &
          Pick<FieldRow, "document_id" | "label"> &
          Record<string, unknown>;
        Update: Partial<FieldRow> & Record<string, unknown>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow & Record<string, unknown>;
        Insert: Partial<AuditLogRow> & Pick<AuditLogRow, "field_id"> & Record<string, unknown>;
        Update: Partial<AuditLogRow> & Record<string, unknown>;
        Relationships: [];
      };
      containers: {
        Row: ContainerRow & Record<string, unknown>;
        Insert: Partial<ContainerRow> & Pick<ContainerRow, "name"> & Record<string, unknown>;
        Update: Partial<ContainerRow> & Record<string, unknown>;
        Relationships: [];
      };
      container_fields: {
        Row: ContainerFieldRow & Record<string, unknown>;
        Insert: Partial<ContainerFieldRow> &
          Pick<ContainerFieldRow, "container_id" | "label"> &
          Record<string, unknown>;
        Update: Partial<ContainerFieldRow> & Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          filter_container_id?: string | null;
        };
        Returns: MatchDocumentsResult[];
      };
      container_field_aggregate: {
        Args: {
          p_container_id: string;
          p_label: string;
          p_agg?: "sum" | "avg" | "count" | "min" | "max";
        };
        Returns: number;
      };
    };
  };
}
