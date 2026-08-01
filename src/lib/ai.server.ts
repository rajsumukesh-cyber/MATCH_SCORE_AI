/**
 * Server-only Lovable AI Gateway client: chat completions + embeddings.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const ANALYSIS_MODEL = "google/gemini-3.6-flash";
export const EMBEDDING_MODEL = "google/gemini-embedding-001";

function apiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured for this project.");
  return key;
}

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function mapGatewayError(status: number, body: string): AiGatewayError {
  if (status === 429)
    return new AiGatewayError("AI is busy right now. Please retry in a moment.", 429);
  if (status === 402)
    return new AiGatewayError("AI credits are exhausted. Top up to continue.", 402);
  console.error("[ai] gateway error", status, body.slice(0, 500));
  return new AiGatewayError("The AI service failed to complete this request.", status);
}

export async function chatJson<T>(args: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
}): Promise<T> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      max_tokens: args.maxTokens ?? 6000,
      response_format: {
        type: "json_schema",
        json_schema: { name: args.schemaName, strict: false, schema: args.schema },
      },
    }),
  });

  if (!res.ok) throw mapGatewayError(res.status, await res.text());

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiGatewayError("The AI returned an empty response.", 502);

  try {
    return JSON.parse(content) as T;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new AiGatewayError("The AI returned an unreadable response.", 502);
  }
}

/** Embed one or more strings. Returns one vector per input. */
export async function embed(inputs: string[]): Promise<number[][]> {
  const trimmed = inputs.map((t) => t.slice(0, 6000));
  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: trimmed }),
  });
  if (!res.ok) throw mapGatewayError(res.status, await res.text());
  const data = (await res.json()) as { data?: { index: number; embedding: number[] }[] };
  const rows = data.data ?? [];
  return rows.sort((a, b) => a.index - b.index).map((r) => r.embedding);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
