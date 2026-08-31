// POST /query-router
// Body: { query: string }
//
// Flow:
//   1. Classify the natural-language query via Claude tool-use: 'filter' (structured, translates to
//      a Postgres query over `fields`) or 'semantic' (translates to a pgvector similarity search).
//   2a. filter mode: build a Postgres query over `fields` (label/value/op) and return matching rows.
//   2b. semantic mode: embed the query text, call `match_documents` RPC, return document matches.
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";
import { embedText } from "../_shared/embeddings.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

interface QueryFilter {
  field: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
  value: string;
}

interface RouteQueryInput {
  mode: "filter" | "semantic";
  filters?: QueryFilter[];
}

const ROUTE_QUERY_TOOL = {
  name: "route_query",
  description:
    "Decide whether this natural-language question needs a structured field filter or a semantic search over document content.",
  input_schema: {
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
        },
      },
    },
    required: ["mode"],
  },
};

const OP_TO_POSTGREST: Record<QueryFilter["op"], string> = {
  eq: "eq",
  neq: "neq",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  contains: "ilike",
};

async function classifyQuery(query: string): Promise<RouteQueryInput> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY env var in Edge Function runtime.");
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      tools: [ROUTE_QUERY_TOOL],
      tool_choice: { type: "tool", name: "route_query" },
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const toolUse = data?.content?.find(
    (block: { type: string }) => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude response did not include a tool_use block.");
  }
  return toolUse.input as RouteQueryInput;
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
