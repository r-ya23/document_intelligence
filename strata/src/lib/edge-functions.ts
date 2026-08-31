import { supabase } from "@/lib/supabase";
import type {
  ApiErrorResponse,
  ExtractRequest,
  ExtractResponse,
  QueryRequest,
  QueryResponse,
} from "@/types/api";

async function invoke<TResponse, TBody extends object>(
  functionName: string,
  body: TBody,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke<TResponse>(functionName, {
    body,
  });

  if (error) {
    // FunctionsHttpError carries the raw Response on `context` — read it to surface the actual
    // { error: "..." } body our functions return, rather than supabase-js's generic
    // "Edge Function returned a non-2xx status code" message.
    const context = (error as { context?: Response }).context;
    let detailedMessage: string | null = null;
    if (context && typeof context.clone === "function") {
      try {
        const body = await context.clone().json();
        if (body && typeof body.error === "string") {
          detailedMessage = body.error;
        }
      } catch {
        // response body wasn't JSON or lacked `error` — fall through to the generic message
      }
    }
    throw new Error(detailedMessage ?? `${functionName} failed: ${error.message}`);
  }
  if (data == null) {
    throw new Error(`${functionName} returned no data.`);
  }
  return data;
}

export async function extractAndStructure(documentId: string): Promise<ExtractResponse> {
  return invoke<ExtractResponse, ExtractRequest>("extract-and-structure", {
    document_id: documentId,
  });
}

export async function routeQuery(query: string): Promise<QueryResponse | ApiErrorResponse> {
  return invoke<QueryResponse | ApiErrorResponse, QueryRequest>("query-router", { query });
}
