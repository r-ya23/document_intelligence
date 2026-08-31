// POST /extract-and-structure
// Body: { document_id: string }
//
// Flow:
//   1. Load the document row + file bytes from Storage.
//   2. Build a Mistral OCR request:
//      - PDF/DOCX/PPTX/images -> `document_url` (base64 data URI), OCR'd directly by Mistral.
//      - Plain text files (txt/csv/md/json) -> no OCR needed, skip straight to structuring using
//        the file's own text via `document_annotation_prompt` context (Mistral OCR is a
//        document/image API, not a generic text endpoint — see below).
//   3. Call Mistral's OCR endpoint (`POST /v1/ocr`) with `document_annotation_format` set to our
//      exact fields JSON schema, so the model both OCRs the document AND returns structured
//      fields in a single request (see docs.mistral.ai/api/endpoint/ocr). The response is still
//      defensively JSON-parsed and validated, since schema enforcement is provider-dependent.
//   4. Write `fields` rows, set `documents.raw_text` (from OCR markdown) + `doc_type`, embed
//      raw_text, write `documents.embedding`, set status = 'ready_for_review'.
//   5. On any failure: status = 'failed' with error_message set, so the frontend can show a retry.
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";
import { embedText } from "../_shared/embeddings.ts";

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const MISTRAL_OCR_MODEL = "mistral-ocr-latest";

// JSON Schema for the fields payload — mirrors the shape the frontend/DB expect exactly
// (see supabase/functions/extract-and-structure and src/types/api.ts on the frontend side).
const FIELDS_JSON_SCHEMA = {
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

const DOCUMENT_ANNOTATION_PROMPT =
  "Extract structured fields from this document and classify its doc_type. Return only JSON " +
  "matching the given schema — no markdown, no commentary.";

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

function isRecordFieldsInput(value: unknown): value is RecordFieldsInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.doc_type === "string" &&
    Array.isArray(v.fields) &&
    v.fields.every(
      (f) =>
        typeof f === "object" &&
        f !== null &&
        typeof (f as Record<string, unknown>).label === "string" &&
        typeof (f as Record<string, unknown>).value === "string" &&
        typeof (f as Record<string, unknown>).confidence === "string",
    )
  );
}

function parseAnnotation(rawAnnotation: string): RecordFieldsInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawAnnotation);
  } catch {
    throw new Error(
      `Mistral OCR document_annotation was not valid JSON (schema enforcement is provider-dependent): ${rawAnnotation.slice(0, 200)}`,
    );
  }

  if (!isRecordFieldsInput(parsed)) {
    throw new Error("Mistral OCR document_annotation did not match the expected fields schema.");
  }

  return parsed;
}

function requireApiKey(): string {
  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) {
    throw new Error("Missing MISTRAL_API_KEY env var in Edge Function runtime.");
  }
  return apiKey;
}

// OCRs a document (PDF/DOCX/PPTX/image) and structures it into our fields schema in one call,
// via Mistral's `document_annotation_format` — no separate OCR + LLM structuring step needed.
async function callMistralOcr(
  documentUrl: string,
): Promise<{ extracted: RecordFieldsInput; rawText: string }> {
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
      document_annotation_prompt: DOCUMENT_ANNOTATION_PROMPT,
      document_annotation_format: {
        type: "json_schema",
        json_schema: {
          name: "record_extracted_fields",
          schema: FIELDS_JSON_SCHEMA,
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

  return { extracted: parseAnnotation(rawAnnotation), rawText };
}

// Plain text files (txt/md/csv/json) aren't documents/images, so they don't go through the OCR
// endpoint — Mistral OCR only accepts document_url/image_url chunks. Instead, we reuse the same
// document_annotation_format contract via a chat completion against Mistral's text model, keeping
// one provider (and one API key) for the whole function.
const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_TEXT_MODEL = "mistral-small-latest";

async function callMistralChat(name: string, rawText: string): Promise<RecordFieldsInput> {
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
        { role: "system", content: DOCUMENT_ANNOTATION_PROMPT },
        {
          role: "user",
          content: `Document name: ${name}\n\n${rawText}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "record_extracted_fields",
          schema: FIELDS_JSON_SCHEMA,
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

  return parseAnnotation(rawContent);
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
      .select("id, name, storage_path")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${docError?.message ?? "no row"}`);
    }

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

    let extracted: RecordFieldsInput;
    let rawText = "";

    if (TEXT_EXTENSIONS.has(ext)) {
      rawText = await fileBlob.text();
      extracted = await callMistralChat(doc.name, rawText);
    } else if (ext in DOCUMENT_MIME_BY_EXT) {
      const buffer = await fileBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const mimeType = DOCUMENT_MIME_BY_EXT[ext];
      const documentUrl = `data:${mimeType};base64,${base64}`;
      const result = await callMistralOcr(documentUrl);
      extracted = result.extracted;
      rawText = result.rawText;
    } else {
      throw new Error(`Unsupported file type: .${ext}`);
    }

    if (extracted.fields.length > 0) {
      const fieldRows = extracted.fields.map((f) => ({
        document_id: documentId,
        label: f.label,
        value: f.value,
        source_span: f.source_span ?? null,
        confidence: f.confidence,
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
      extracted.fields.map((f) => `${f.label}: ${f.value}`).join("\n");

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
        doc_type: extracted.doc_type,
        raw_text: rawText || null,
        embedding,
        status: "ready_for_review",
        error_message: null,
      })
      .eq("id", documentId);

    return jsonResponse({ status: "ready_for_review", fields: extracted.fields });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("extract-and-structure failed:", message);

    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);

    return jsonResponse({ status: "failed", error: message }, 500);
  }
});
