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

export interface DocumentRow {
  id: string;
  name: string;
  storage_path: string;
  doc_type: DocType | null;
  status: DocumentStatus;
  error_message: string | null;
  raw_text: string | null;
  embedding: number[] | null;
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
    };
    Views: Record<string, never>;
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
        };
        Returns: MatchDocumentsResult[];
      };
    };
  };
}
