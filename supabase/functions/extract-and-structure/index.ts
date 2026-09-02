// POST /extract-and-structure
// Body: { document_id: string }   (container_id is read from the document row itself)
//
// Flow:
//   1. Load the document row + file bytes from Storage. If the document belongs to a container,
//      load that container's field schema (container_fields).
//   2. Build the extraction JSON schema:
//      - Contained document -> a schema-DRIVEN payload: the model is asked to fill in exactly the
//        container's defined fields (with their types + descriptions), plus an `additional_fields`
//        array for anything it finds outside the schema (loose-with-flagging: extras are captured,
//        never silently dropped).
//      - Uncontained document (container_id = null) -> the original open-ended schema: the model
//        decides the labels itself.
//   3. Send to Mistral:
//      - PDF/DOCX/PPTX/images -> `document_url` (base64 data URI), OCR'd directly by Mistral.
//      - Plain text files (txt/csv/md/json) -> chat completion, no OCR (Mistral OCR is a
//        document/image API, not a generic text endpoint).
//   4. Reconcile the model output against the container schema: schema fields become first-class
//      `fields` rows (is_schema_field = true, field_type from the schema); missing required fields
//      are inserted empty and flagged confidence = 'review'; extras become is_schema_field = false.
//   5. Set `documents.raw_text` + `doc_type`, embed, write `documents.embedding`, set
//      status = 'ready_for_review'.
//   6. On any failure: status = 'failed' with error_message set, so the frontend can show a retry.
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";
import { embedText } from "../_shared/embeddings.ts";

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const MISTRAL_OCR_MODEL = "mistral-ocr-latest";

type FieldType = "text" | "number" | "currency" | "date";

interface ContainerFieldSchema {
  label: string;
  field_type: FieldType;
  required: boolean;
  description: string | null;
}

// Open-ended schema, used for uncontained documents (no container schema to conform to).
// The model decides the labels itself.
const OPEN_FIELDS_JSON_SCHEMA = {
  type: "object",
  properties: {
    doc_type: {
      type: "string",
      enum: ["invoice", "contract", "resume", "other"],
    },
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          source_span: {
            type: ["string", "null"],
            description:
              "exact text this value was read from, or null if no exact span applies",
          },
          confidence: { type: "string", enum: ["high", "review"] },
        },
        required: ["label", "value", "source_span", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["doc_type", "fields"],
  additionalProperties: false,
};

// deno-lint-ignore no-explicit-any
type JsonSchema = Record<string, any>;

// Build a schema-driven payload from a container's field definitions. The model is asked to fill
// in exactly these fields (as first-class object properties, so the shape is enforced), plus an
// `additional_fields` array for anything found outside the schema.
function buildContainerFieldsSchema(schema: ContainerFieldSchema[]): JsonSchema {
  const fieldEntry = {
    type: "object",
    properties: {
      value: { type: ["string", "null"] },
      source_span: {
        type: ["string", "null"],
        description: "exact text this value was read from, or null if no exact span applies",
      },
      confidence: { type: "string", enum: ["high", "review"] },
    },
    required: ["value", "source_span", "confidence"],
    additionalProperties: false,
  };

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const f of schema) {
    properties[f.label] = fieldEntry;
    required.push(f.label);
  }

  return {
    type: "object",
    properties: {
      doc_type: { type: "string", enum: ["invoice", "contract", "resume", "other"] },
      schema_fields: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
        description: "One entry per requested field. If a field is absent in the document, set its value to null.",
      },
      additional_fields: {
        type: "array",
        description: "Fields present in the document but NOT in the requested set. Capture them here.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            source_span: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["high", "review"] },
          },
          required: ["label", "value", "source_span", "confidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["doc_type", "schema_fields", "additional_fields"],
    additionalProperties: false,
  };
}

function openPrompt(): string {
  return (
    "Extract structured fields from this document and classify its doc_type. Return only JSON " +
    "matching the given schema — no markdown, no commentary."
  );
}

function containerPrompt(schema: ContainerFieldSchema[]): string {
  const lines = schema.map((f) => {
    const hint = f.description ? ` — ${f.description}` : "";
    const req = f.required ? " (required)" : "";
    return `- ${f.label} [${f.field_type}]${req}${hint}`;
  });
  return (
    "Extract structured data from this document. Fill in EXACTLY these fields under schema_fields; " +
    "if a field is not present in the document, set its value to null (do not guess). Any field " +
    "you find that is NOT in this list goes into additional_fields.\n\n" +
    "Requested fields:\n" +
    lines.join("\n") +
    "\n\nClassify doc_type. Return only JSON matching the given schema — no markdown, no commentary."
  );
}

interface ExtractedField {
  label: string;
  value: string;
  source_span: string | null;
  confidence: "high" | "review";
}

interface RecordFieldsInput {
  doc_type: "invoice" | "contract" | "resume" | "other";
  fields: ExtractedField[];
}

// Result of reconciling model output: a flat list of field rows ready to insert, each tagged with
// its type and whether it belongs to the container schema.
interface ReconciledField extends ExtractedField {
  field_type: FieldType;
  is_schema_field: boolean;
}

// Mistral OCR document/image types it accepts via a data URI, per file extension.
// PDF/DOCX/PPTX/images all go through the same `document_url` chunk type — Mistral OCR reads the
// mime type from the data URI itself, so this map only needs to cover what our uploader allows.
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json"]);
const DOCUMENT_MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function getExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

// Base64-encode bytes without any spread. `btoa(String.fromCharCode(...bytes))` spreads every
// byte as a function argument, which overflows the call stack ("Maximum call stack size
// exceeded") on real files. Even chunked spreads (`fromCharCode(...subarray)`) can trip some
// runtimes. This builds the binary string one byte at a time — no spread, no arg-count limit,
// cannot overflow regardless of file size.
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    out += BASE64_CHARS[b0 >> 2];
    out += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < len ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < len ? BASE64_CHARS[b2 & 0x3f] : "=";
  }
  return out;
}

function normalizeConfidence(v: unknown): "high" | "review" {
  return v === "review" ? "review" : "high";
}

// Parse + reconcile the model's raw JSON into a flat list of field rows.
//   - If `schema` is provided (contained document): read schema_fields (first-class, typed) and
//     additional_fields (extras, is_schema_field = false). Missing/null required fields are still
//     emitted (empty value) but flagged confidence = 'review' so a human reviews them.
//   - If `schema` is null (uncontained document): read the open `fields` array, all is_schema_field
//     = true, field_type = 'text'.
function parseAndReconcile(
  raw: string,
  schema: ContainerFieldSchema[] | null,
): { doc_type: RecordFieldsInput["doc_type"]; fields: ReconciledField[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Mistral response was not valid JSON (schema enforcement is provider-dependent): ${raw.slice(0, 200)}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Mistral response was not a JSON object.");
  }
  const obj = parsed as Record<string, unknown>;
  const doc_type = (typeof obj.doc_type === "string" ? obj.doc_type : "other") as
    RecordFieldsInput["doc_type"];

  // ---- open-ended (uncontained) path ----
  if (schema === null) {
    if (!Array.isArray(obj.fields)) {
      throw new Error("Mistral response did not include a fields array.");
    }
    const fields: ReconciledField[] = obj.fields
      .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
      .map((f) => ({
        label: String(f.label ?? ""),
        value: f.value == null ? "" : String(f.value),
        source_span: typeof f.source_span === "string" ? f.source_span : null,
        confidence: normalizeConfidence(f.confidence),
        field_type: "text" as FieldType,
        is_schema_field: true,
      }))
      .filter((f) => f.label.length > 0);
    return { doc_type, fields };
  }

  // ---- schema-driven (contained) path ----
  const schemaFieldsObj =
    typeof obj.schema_fields === "object" && obj.schema_fields !== null
      ? (obj.schema_fields as Record<string, unknown>)
      : {};

  const fields: ReconciledField[] = schema.map((def) => {
    const entry = schemaFieldsObj[def.label];
    const e = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    const rawValue = e.value;
    const hasValue = rawValue != null && String(rawValue).trim().length > 0;
    return {
      label: def.label,
      value: hasValue ? String(rawValue) : "",
      source_span: typeof e.source_span === "string" ? e.source_span : null,
      // A missing/empty required field always needs human attention regardless of what the model
      // claimed; otherwise honor the model's self-reported confidence.
      confidence: def.required && !hasValue ? "review" : normalizeConfidence(e.confidence),
      field_type: def.field_type,
      is_schema_field: true,
    };
  });

  // extras: fields the model found that aren't in the container schema
  if (Array.isArray(obj.additional_fields)) {
    for (const f of obj.additional_fields) {
      if (typeof f !== "object" || f === null) continue;
      const rec = f as Record<string, unknown>;
      const label = String(rec.label ?? "");
      if (!label) continue;
      fields.push({
        label,
        value: rec.value == null ? "" : String(rec.value),
        source_span: typeof rec.source_span === "string" ? rec.source_span : null,
        confidence: normalizeConfidence(rec.confidence),
        field_type: "text",
        is_schema_field: false,
      });
    }
  }

  return { doc_type, fields };
}

function requireApiKey(): string {
  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) {
    throw new Error("Missing MISTRAL_API_KEY env var in Edge Function runtime.");
  }
  return apiKey;
}

// OCRs a document (PDF/DOCX/PPTX/image) and structures it in one call via Mistral's
// `document_annotation_format`. The caller supplies the JSON schema + prompt (open-ended for
// uncontained docs, schema-driven for contained ones); this returns the raw annotation string
// and the OCR markdown, leaving reconciliation to the handler.
async function callMistralOcr(
  documentUrl: string,
  jsonSchema: JsonSchema,
  prompt: string,
): Promise<{ rawAnnotation: string; rawText: string }> {
  const apiKey = requireApiKey();

  const res = await fetch(MISTRAL_OCR_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MISTRAL_OCR_MODEL,
      document: {
        type: "document_url",
        document_url: documentUrl,
      },
      document_annotation_prompt: prompt,
      document_annotation_format: {
        type: "json_schema",
        json_schema: {
          name: "record_extracted_fields",
          schema: jsonSchema,
          strict: true,
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Mistral OCR API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawAnnotation = data?.document_annotation;
  if (typeof rawAnnotation !== "string") {
    throw new Error("Mistral OCR response did not include a document_annotation.");
  }

  const rawText = Array.isArray(data?.pages)
    ? data.pages.map((p: { markdown?: string }) => p.markdown ?? "").join("\n\n")
    : "";

  return { rawAnnotation, rawText };
}

// Plain text files (txt/md/csv/json) aren't documents/images, so they don't go through the OCR
// endpoint — Mistral OCR only accepts document_url/image_url chunks. Instead, we reuse the same
// json_schema contract via a chat completion against Mistral's text model, keeping one provider
// (and one API key) for the whole function.
const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_TEXT_MODEL = "mistral-small-latest";

async function callMistralChat(
  name: string,
  rawText: string,
  jsonSchema: JsonSchema,
  prompt: string,
): Promise<string> {
  const apiKey = requireApiKey();

  const res = await fetch(MISTRAL_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MISTRAL_TEXT_MODEL,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Document name: ${name}\n\n${rawText}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "record_extracted_fields",
          schema: jsonSchema,
          strict: true,
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Mistral chat API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string") {
    throw new Error("Mistral chat response did not include message content.");
  }

  return rawContent;
}

// Load a container's field schema (empty array if the document is uncontained).
// deno-lint-ignore no-explicit-any
async function loadContainerSchema(
  supabase: any,
  containerId: string | null,
): Promise<ContainerFieldSchema[]> {
  if (!containerId) return [];
  const { data, error } = await supabase
    .from("container_fields")
    .select("label, field_type, required, description")
    .eq("container_id", containerId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load container schema: ${error.message}`);
  return (data ?? []) as ContainerFieldSchema[];
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let documentId: string | undefined;
  try {
    const body = await req.json();
    documentId = body?.document_id;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!documentId) {
    return jsonResponse({ error: "document_id is required" }, 400);
  }

  const supabase = getAdminClient();

  try {
    await supabase
      .from("documents")
      .update({ status: "extracting" })
      .eq("id", documentId);

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, name, storage_path, container_id")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${docError?.message ?? "no row"}`);
    }

    // Load the container's field schema. Empty when uncontained -> open-ended extraction.
    const schema = await loadContainerSchema(supabase, doc.container_id ?? null);
    const useSchema = schema.length > 0 ? schema : null;
    const jsonSchema = useSchema ? buildContainerFieldsSchema(useSchema) : OPEN_FIELDS_JSON_SCHEMA;
    const prompt = useSchema ? containerPrompt(useSchema) : openPrompt();

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError || !fileBlob) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const ext = getExtension(doc.name);

    await supabase
      .from("documents")
      .update({ status: "structuring" })
      .eq("id", documentId);

    let doc_type: RecordFieldsInput["doc_type"];
    let fields: ReconciledField[];
    let rawText = "";

    if (TEXT_EXTENSIONS.has(ext)) {
      rawText = await fileBlob.text();
      const raw = await callMistralChat(doc.name, rawText, jsonSchema, prompt);
      ({ doc_type, fields } = parseAndReconcile(raw, useSchema));
    } else if (ext in DOCUMENT_MIME_BY_EXT) {
      const buffer = await fileBlob.arrayBuffer();
      const base64 = bytesToBase64(new Uint8Array(buffer));
      const mimeType = DOCUMENT_MIME_BY_EXT[ext];
      const documentUrl = `data:${mimeType};base64,${base64}`;
      const result = await callMistralOcr(documentUrl, jsonSchema, prompt);
      rawText = result.rawText;
      ({ doc_type, fields } = parseAndReconcile(result.rawAnnotation, useSchema));
    } else {
      throw new Error(`Unsupported file type: .${ext}`);
    }

    if (fields.length > 0) {
      const fieldRows = fields.map((f) => ({
        document_id: documentId,
        label: f.label,
        value: f.value,
        source_span: f.source_span ?? null,
        confidence: f.confidence,
        field_type: f.field_type,
        is_schema_field: f.is_schema_field,
        verified: false,
      }));
      const { error: insertError } = await supabase.from("fields").insert(fieldRows);
      if (insertError) {
        throw new Error(`Failed to insert fields: ${insertError.message}`);
      }
    }

    // raw_text is the OCR markdown (documents) or the file's own text (plain text files); for
    // images/PDFs with no extractable text, fall back to a text summary of the extracted fields
    // so there's still something to embed for semantic search.
    const textForEmbedding = rawText ||
      fields.map((f) => `${f.label}: ${f.value}`).join("\n");

    let embedding: number[] | null = null;
    try {
      embedding = await embedText(textForEmbedding);
    } catch (embedErr) {
      // Embedding failure shouldn't fail the whole extraction — structured fields are the
      // primary value; semantic search degrades gracefully if embedding is null.
      console.error("Embedding failed, continuing without it:", embedErr);
    }

    await supabase
      .from("documents")
      .update({
        doc_type,
        raw_text: rawText || null,
        embedding,
        status: "ready_for_review",
        error_message: null,
      })
      .eq("id", documentId);

    return jsonResponse({
      status: "ready_for_review",
      fields: fields.map((f) => ({
        label: f.label,
        value: f.value,
        source_span: f.source_span,
        confidence: f.confidence,
        field_type: f.field_type,
        is_schema_field: f.is_schema_field,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("extract-and-structure failed:", message);

    // Entirely fail the document: clean up any field rows that were inserted before the failure
    // so a failed doc never looks like it has partial data, then mark it failed with the error.
    // The storage file is intentionally kept (not deleted) so it's available for debugging/logs
    // and for retrying extraction without a re-upload.
    const { error: cleanupError } = await supabase
      .from("fields")
      .delete()
      .eq("document_id", documentId);
    if (cleanupError) {
      console.error("Failed to clean up partial fields on failure:", cleanupError.message);
    }

    await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message: message,
        doc_type: null,
        raw_text: null,
        embedding: null,
      })
      .eq("id", documentId);

    return jsonResponse({ status: "failed", error: message }, 500);
  }
});
