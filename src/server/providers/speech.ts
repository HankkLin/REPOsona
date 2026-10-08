import { createHash } from "node:crypto";
import { z } from "zod";
import type { Project } from "@/domain/schemas";
import { googleModels } from "../models";

const voices = ["Kore", "Puck", "Charon", "Aoede", "Fenrir", "Leda", "Orus", "Zephyr"] as const;
export function voiceName(project: Project) {
  return project.persona.voice.name || voices[createHash("sha256").update(project.repository.url).digest()[0] % voices.length];
}
export async function synthesizeSpeech(project: Project, text: string) {
  if (project.demo) return { mode: "demo" as const };
  if (!process.env.GEMINI_API_KEY) throw new Error("Configure GEMINI_API_KEY for persona speech.");
  const voice = project.persona.voice;
  const name = voiceName(project);
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      model: googleModels().tts,
      input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: `${voice.tone}. ${project.persona.speakingStyle}. Language ${voice.language}. Pace ${voice.rate < 1 ? "slightly relaxed" : voice.rate > 1 ? "slightly brisk" : "natural"}, pitch ${voice.pitch < 1 ? "slightly low" : voice.pitch > 1 ? "slightly high" : "natural"}.` }] }] }],
      response_format: { type: "audio" }, generation_config: { speech_config: [{ voice: name }] },
    }), signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Gemini speech request failed (${response.status}). Your text answer is still available.`);
  const result = z.object({ steps: z.array(z.object({ type: z.string(), content: z.array(z.object({ type: z.string(), data: z.string().optional() })).optional() })) }).safeParse(await response.json());
  const audio = result.success ? result.data.steps.filter(step => step.type === "model_output").flatMap(step => step.content || []).filter(part => part.type === "audio").at(-1)?.data : undefined;
  if (!audio || !/^[A-Za-z0-9+/=\s]+$/.test(audio)) throw new Error("Gemini returned no usable speech. Your text answer is still available.");
  const bytes = Buffer.from(audio, "base64");
  if (bytes.length < 44 || bytes.subarray(0, 4).toString() !== "RIFF" || bytes.subarray(8, 12).toString() !== "WAVE") throw new Error("Gemini returned an unsupported audio format. Expected WAV.");
  return { mode: "live" as const, audio: `data:audio/wav;base64,${bytes.toString("base64")}`, voice: name };
}
