// Embedding helper — Voyage AI `voyage-3` by default (1024 dims, matches the `documents.embedding`
// column). Swap the implementation if you use OpenAI `text-embedding-3-small` instead (also 1024
// dims via the `dimensions` param), keeping the same 1024-dim contract with the DB column.

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

export async function embedText(text: string): Promise<number[]> {
  const apiKey = Deno.env.get("EMBEDDING_API_KEY");
  if (!apiKey) {
    throw new Error("Missing EMBEDDING_API_KEY env var in Edge Function runtime.");
  }

  // Voyage caps input length; truncate defensively so a huge raw_text doesn't fail the call.
  const input = text.slice(0, 20000);

  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [input],
      model: "voyage-3",
      output_dimension: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Embedding API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const embedding = data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding API returned an unexpected response shape.");
  }
  return embedding as number[];
}
