// Container data layer — Supabase-backed via React Query.
//
// Containers and their field schema live in the `containers` / `container_fields` tables
// (see supabase/migrations/20260902000000_containers_schema.sql). "Extractions" aren't a table:
// they're derived from real `documents` grouped by container_id, so the extractions log reflects
// actual uploaded/processed documents rather than a separate mock record.
//
// The hook return shapes stay camelCase (Container/Extraction from ./types) so the existing pages
// (dashboard, detail, wizard) don't need to change — DB snake_case rows are mapped here.
import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ContainerRow, DocumentRow } from "@/types/db";
import type { Container, Extraction, NewContainerInput } from "./types";

export const CONTAINERS_QUERY_KEY = ["containers"] as const;

function mapContainer(row: ContainerRow): Container {
  return {
    id: row.id,
    name: row.name,
    docType: row.doc_type ?? "other",
    defaultMode: row.default_mode,
    createdAt: row.created_at,
  };
}

// ── Queries ─────────────────────────────────────────────────────────────────

async function fetchContainers(): Promise<Container[]> {
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("Failed to fetch")) {
      throw new Error("Can't reach the server. Check your connection and try again.");
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapContainer(r as ContainerRow));
}

// List query + Realtime subscription, mirroring useDocuments: any change to `containers`
// invalidates the query so the dashboard stays live without polling.
export function useContainersQuery(): UseQueryResult<Container[]> {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CONTAINERS_QUERY_KEY,
    queryFn: fetchContainers,
  });

  useEffect(() => {
    const channel = supabase
      .channel("containers-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "containers" },
        () => queryClient.invalidateQueries({ queryKey: CONTAINERS_QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// Backwards-compatible convenience hooks returning plain data (what the pages already consume).
export function useContainers(): Container[] {
  return useContainersQuery().data ?? [];
}

export function useContainer(containerId: string | undefined): Container | undefined {
  const containers = useContainers();
  return containers.find((c) => c.id === containerId);
}

// ── Extractions (derived from documents grouped by container) ─────────────────

async function fetchDocumentsForContainer(containerId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("container_id", containerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

// Map a document's real status to the extraction-log label. A failed extraction shows as
// "failed" (not published), an in-flight one as "processing", and a finished one as "published".
function statusToExtractionStatus(status: DocumentRow["status"]): Extraction["status"] {
  if (status === "failed") return "failed";
  if (status === "ready_for_review" || status === "verified") return "published";
  return "processing"; // queued | extracting | structuring
}

// One "extraction" per document that belongs to the container. docCount is 1 (per-document);
// this keeps the extractions-log UI meaningful against real data without a separate table.
function docToExtraction(doc: DocumentRow, containerId: string): Extraction {
  return {
    id: doc.id,
    containerId,
    label: doc.name,
    docCount: 1,
    createdAt: doc.created_at,
    status: statusToExtractionStatus(doc.status),
    documentIds: [doc.id],
  };
}

export function useExtractions(containerId: string | undefined): Extraction[] {
  const query = useQuery({
    queryKey: ["extractions", containerId],
    queryFn: () => fetchDocumentsForContainer(containerId!),
    enabled: !!containerId,
  });
  return (query.data ?? []).map((d) => docToExtraction(d, containerId!));
}

async function fetchAllContainedDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .not("container_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRow[];
}

export function useAllExtractions(): Extraction[] {
  const query = useQuery({
    queryKey: ["extractions", "all"],
    queryFn: fetchAllContainedDocuments,
  });
  return (query.data ?? []).map((d) => docToExtraction(d, d.container_id ?? ""));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

// Create a container plus its field schema. Inserts the container row first, then the
// container_fields rows referencing it. If the schema insert fails, the container row is deleted
// so we don't leave a schema-less container behind (best-effort rollback; no DB transaction).
async function createContainer(input: NewContainerInput): Promise<Container> {
  const { data: containerRow, error: containerError } = await supabase
    .from("containers")
    .insert({
      name: input.name,
      doc_type: input.docType,
      default_mode: input.defaultMode,
    })
    .select()
    .single();

  if (containerError || !containerRow) {
    throw new Error(`Failed to create container: ${containerError?.message ?? "no row returned"}`);
  }

  const cleanFields = input.fields
    .map((f, i) => ({
      container_id: containerRow.id,
      label: f.label.trim(),
      field_type: f.fieldType,
      required: f.required,
      description: f.description?.trim() || null,
      sort_order: i,
    }))
    .filter((f) => f.label.length > 0);

  if (cleanFields.length > 0) {
    const { error: fieldsError } = await supabase.from("container_fields").insert(cleanFields);
    if (fieldsError) {
      // best-effort rollback so we don't strand a container with no schema
      await supabase.from("containers").delete().eq("id", containerRow.id);
      throw new Error(`Failed to save container schema: ${fieldsError.message}`);
    }
  }

  return mapContainer(containerRow as ContainerRow);
}

export function useCreateContainer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createContainer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTAINERS_QUERY_KEY });
    },
  });
}
