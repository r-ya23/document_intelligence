// POST /query-router
// Body: { query: string }
//
// Flow:
//   1. Classify the natural-language query via Mistral chat completions (JSON schema mode):
//      'filter' (structured, translates to a Postgres query over `fields`) or 'semantic'
//      (translates to a pgvector similarity search).
//   2a. filter mode: build a Postgres query over `fields` (label/value/op) and return matching rows.
//   2b. semantic mode: embed the query text, call `match_documents` RPC, return document matches.
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";
import { embedText } from "../_shared/embeddings.ts";

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-small-latest";

interface QueryFilter {
  field: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
  value: string;
}

interface RouteQueryInput {
  mode: "filter" | "semantic";
  filters?: QueryFilter[];
}

// JSON Schema for the routing decision — mirrors the shape the previous Claude tool_use call
// produced, so downstream code (runFilterQuery, response shape) needs no changes.
const ROUTE_QUERY_JSON_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["filter", "semantic"] },
    filters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string", description: "the field label to filter on, e.g. total_due" },
          op: {
            type: "string",
            enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contains"],
          },
          value: { type: "string" },
        },
        required: ["field", "op", "value"],
        additionalProperties: false,
      },
    },
  },
  required: ["mode", "filters"],
  additionalProperties: false,
};

const ROUTE_QUERY_SYSTEM_PROMPT =
  "Decide whether this natural-language question needs a structured field filter or a semantic " +
  "search over document content. Use mode 'filter' when the question names a specific field and " +
  "a comparison (e.g. 'invoices over $500', 'contracts dated after 2024'), extracting each as " +
  "{field, op, value}. Use mode 'semantic' for conceptual/fuzzy questions with no clear field " +
  "comparison, and return an empty filters array. Return only JSON matching the given schema — " +
  "no markdown, no commentary.";

const OP_TO_POSTGREST: Record<QueryFilter["op"], string> = {
  eq: "eq",
  neq: "neq",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  contains: "ilike",
};

function isRouteQueryInput(value: unknown): value is RouteQueryInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.mode !== "filter" && v.mode !== "semantic") return false;
  if (v.filters === undefined) return true;
  return (
    Array.isArray(v.filters) &&
    v.filters.every(
      (f) =>
        typeof f === "object" &&
        f !== null &&
        typeof (f as Record<string, unknown>).field === "string" &&
        typeof (f as Record<string, unknown>).op === "string" &&
        typeof (f as Record<string, unknown>).value === "string",
    )
  );
}

async function classifyQuery(query: string): Promise<RouteQueryInput> {
  const apiKey = Deno.env.get("MISTRAL_API_KEY");
  if (!apiKey) {
    throw new Error("Missing MISTRAL_API_KEY env var in Edge Function runtime.");
  }

  const res = await fetch(MISTRAL_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [
        { role: "system", content: ROUTE_QUERY_SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "route_query",
          schema: ROUTE_QUERY_JSON_SCHEMA,
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
    throw new Error("Mistral response did not include message content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(
      `Mistral response was not valid JSON (schema enforcement is provider-dependent): ${rawContent.slice(0, 200)}`,
    );
  }

  if (!isRouteQueryInput(parsed)) {
    throw new Error("Mistral response did not match the expected route_query schema.");
  }

  return parsed;
}

// deno-lint-ignore no-explicit-any
async function runFilterQuery(supabase: any, filters: QueryFilter[]) {
  // Each filter narrows to fields matching label + value predicate, then we roll up matching
  // field rows into their parent documents. Multiple filters are applied as an AND by running one
  // query per filter and intersecting document_ids — simplest correct approach for a small filter
  // list; a single field row can only satisfy one label/value pair at a time so filters can't be
  // combined in one `fields` query when they target different labels.
  let matchingDocIds: Set<string> | null = null;

  for (const filter of filters) {
    let q = supabase
      .from("fields")
      .select("document_id, label, value")
      .eq("label", filter.field);

    const pgOp = OP_TO_POSTGREST[filter.op];
    const value = filter.op === "contains" ? `%${filter.value}%` : filter.value;
    q = q[pgOp]("value", value);

    const { data, error } = await q;
    if (error) throw new Error(`Filter query failed: ${error.message}`);

    const docIds = new Set((data ?? []).map((r: { document_id: string }) => r.document_id));
    matchingDocIds = matchingDocIds === null
      ? docIds
      : new Set([...matchingDocIds].filter((id) => docIds.has(id)));
  }

  const ids = matchingDocIds ? [...matchingDocIds] : [];
  if (ids.length === 0) return [];

  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("id, name, doc_type, status, created_at")
    .in("id", ids);

  if (docsError) throw new Error(`Failed to load matching documents: ${docsError.message}`);

  // attach the matching fields per document for context in the results view
  const { data: allFields } = await supabase
    .from("fields")
    .select("document_id, label, value, confidence")
    .in("document_id", ids);

  return (documents ?? []).map((doc: { id: string }) => ({
    ...doc,
    fields: (allFields ?? []).filter((f: { document_id: string }) => f.document_id === doc.id),
  }));
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let query: string | undefined;
  try {
    const body = await req.json();
    query = body?.query;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!query || typeof query !== "string") {
    return jsonResponse({ error: "query is required" }, 400);
  }

  const supabase = getAdminClient();

  try {
    const routed = await classifyQuery(query);

    if (routed.mode === "filter") {
      const results = await runFilterQuery(supabase, routed.filters ?? []);
      return jsonResponse({ mode: "filter", filters: routed.filters ?? [], results });
    }

    // semantic mode
    const embedding = await embedText(query);
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 10,
    });

    if (error) throw new Error(`Semantic search failed: ${error.message}`);

    return jsonResponse({ mode: "semantic", results: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("query-router failed:", message);
    return jsonResponse({ error: message }, 500);
  }
});
