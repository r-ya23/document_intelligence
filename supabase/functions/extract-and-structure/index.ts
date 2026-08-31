// POST /extract-and-structure
// Body: { document_id: string }
//
// Flow:
//   1. Load the document row + file bytes from Storage.
//   2. Build a chat message: plain text for text-based files (txt/csv/md/json), an image_url
//      content block (base64 data URI) for scans — Qwen2.5-VL reads the image directly, no
//      separate OCR step.
//   3. Call Qwen2.5-VL via the Hugging Face router's OpenAI-compatible chat completions endpoint,
//      with `response_format: { type: "json_schema", ... }` to constrain the output to our exact
//      fields schema. Enforcement is provider-dependent (unlike Anthropic's tool_choice, which
//      guarantees the shape), so the response is still defensively JSON-parsed and validated.
//   4. Write `fields` rows, set `documents.raw_text` + `doc_type`, embed raw_text, write
//      `documents.embedding`, set status = 'ready_for_review'.
//   5. On any failure: status = 'failed' with error_message set, so the frontend can show a retry.
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";
import { embedText } from "../_shared/embeddings.ts";

const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const QWEN_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct:fastest";

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

const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json"]);
const IMAGE_MIME_BY_EXT: Record<string, string> = {
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

async function callQwen(content: unknown[]): Promise<RecordFieldsInput> {
  const apiKey = Deno.env.get("HF_TOKEN");
  if (!apiKey) {
    throw new Error("Missing HF_TOKEN env var in Edge Function runtime.");
  }

  const res = await fetch(HF_ROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Extract structured fields from the document provided. Return only JSON matching the given schema — no markdown, no commentary.",
        },
        { role: "user", content },
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
    throw new Error(`Qwen (Hugging Face) API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string") {
    throw new Error("Qwen response did not include message content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(
      `Qwen response was not valid JSON (schema enforcement is provider-dependent): ${rawContent.slice(0, 200)}`,
    );
  }

  if (!isRecordFieldsInput(parsed)) {
    throw new Error("Qwen response did not match the expected fields schema.");
  }

  return parsed;
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
    let content: unknown[];
    let rawText = "";

    if (TEXT_EXTENSIONS.has(ext)) {
      rawText = await fileBlob.text();
      content = [
        {
          type: "text",
          text:
            `Extract structured fields from this document. Document name: ${doc.name}\n\n${rawText}`,
        },
      ];
    } else if (ext in IMAGE_MIME_BY_EXT) {
      const buffer = await fileBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const mimeType = IMAGE_MIME_BY_EXT[ext];
      content = [
        {
          type: "text",
          text: `Extract structured fields from this document (${doc.name}).`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` },
        },
      ];
    } else if (ext === "pdf") {
      // PDF text-lib extraction (pdf-parse equivalent) is a Day 2 addition per the plan;
      // for now route PDFs through the vision path as page images is out of scope for a
      // single-request flow, so treat as unsupported until a text-extraction step is added.
      throw new Error(
        `PDF extraction requires a text-extraction step not yet implemented. Upload txt/image files for now.`,
      );
    } else {
      throw new Error(`Unsupported file type: .${ext}`);
    }

    await supabase
      .from("documents")
      .update({ status: "structuring" })
      .eq("id", documentId);

    const extracted = await callQwen(content);

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

    // raw_text may already be set for text files; for images, fall back to a text summary of
    // extracted fields so there's still something to embed for semantic search.
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
