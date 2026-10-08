import { z } from "zod";

const vectorSchema = z.array(z.number().finite()).length(768).refine(v => v.some(n => n !== 0), "Embedding cannot be a zero vector");
export async function embedTexts(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY", model: string) {
  if (!texts.length) return [];
  if (!process.env.GEMINI_API_KEY) throw new Error("Configure GEMINI_API_KEY for repository retrieval.");
  const requests = texts.map(text => ({ model: `models/${model}`, content: { parts: [{ text }] }, embedContentConfig: { taskType, outputDimensionality: 768 } }));
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ requests }), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Google embeddings request failed (${response.status}). Check model access and quota.`);
  const result = z.object({ embeddings: z.array(z.object({ values: vectorSchema })) }).safeParse(await response.json());
  if (!result.success || result.data.embeddings.length !== texts.length) throw new Error("Google returned invalid repository embeddings.");
  return result.data.embeddings.map(e => e.values);
}
