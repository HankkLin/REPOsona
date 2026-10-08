import { z } from "zod";
import { googleModels } from "../models";

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
export async function generate(model: string, system: string, parts: Part[], image = false) {
  if (!process.env.GEMINI_API_KEY) throw new Error("Configure GEMINI_API_KEY for live mode.");
  if (!model) throw new Error("Configure GEMINI_IMAGE_MODEL with your exact Nano Banana model identifier.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts }], generationConfig: image ? { responseModalities: ["TEXT", "IMAGE"] } : { responseMimeType: "application/json" } }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}). Check credentials, model access, and quota.`);
  const result = await response.json();
  const output = result.candidates?.[0]?.content?.parts;
  if (!Array.isArray(output)) throw new Error("Gemini returned no usable output. Try a different prompt.");
  return output as { text?: string; thought?: boolean; inlineData?: { mimeType: string; data: string } }[];
}
export async function generateJson<T>(system: string, input: unknown, schema: z.ZodType<T>, model = googleModels().flash): Promise<T> {
  const parts = await generate(model, system, [{ text: JSON.stringify(input) }]);
  try { return schema.parse(JSON.parse(parts.map(p => p.text || "").join(""))); }
  catch { throw new Error("Gemini returned an invalid structured response. Please retry."); }
}
