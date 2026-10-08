import { z } from "zod";

export const personaSchema = z.object({
  name: z.string().min(1).max(80),
  tagline: z.string().max(200),
  backstory: z.string().max(1200),
  traits: z.array(z.string().max(80)).min(1).max(6),
  convictions: z.array(z.string().max(300)).max(6),
  speakingStyle: z.string().max(500),
  visualPrompt: z.string().max(2000),
  // User-research persona fields; optional so personas saved before they existed still load.
  archetype: z.string().max(80).optional(),
  audience: z.string().max(300).optional(),
  goals: z.array(z.string().max(200)).max(4).optional(),
  frustrations: z.array(z.string().max(200)).max(4).optional(),
  dna: z.object({ stability: z.number().min(0).max(100), strictness: z.number().min(0).max(100), playfulness: z.number().min(0).max(100) }).optional(),
  voice: z.object({ language: z.string().max(30), tone: z.string().max(200), direction: z.string().trim().max(400).optional(), casting: z.string().trim().min(1).max(450).optional(), wpm: z.number().int().min(80).max(220).optional(), rate: z.number().min(0.5).max(1.5), pitch: z.number().min(0.5).max(1.5), name: z.enum(["Kore", "Puck", "Charon", "Aoede", "Fenrir", "Leda", "Orus", "Zephyr"]).optional() }),
});
export type Persona = z.infer<typeof personaSchema>;
export type Repository = { owner: string; name: string; url: string; readme: string; sourceUrl: string; truncated: boolean };
export type Avatar = { id: string; image: string; suggestion: string; createdAt: string };
export type KnowledgeChunk = { id: string; startLine: number; endLine: number; text: string; embedding?: number[] };
export type KnowledgeBase = { sourceHash: string; embeddingModel: string; chunks: KnowledgeChunk[] };
export type Project = { id: string; ownerSession: string; demo: boolean; repository: Repository; persona: Persona; avatars: Avatar[]; approvedAvatarId?: string; knowledgeBase?: KnowledgeBase };
export type AnswerMode = "flash" | "pro";
export const answerSchema = z.object({
  answer: z.string().min(1).max(10000),
  citations: z.array(z.object({ startLine: z.number().int().positive(), endLine: z.number().int().positive() })).max(8),
});
export type Answer = z.infer<typeof answerSchema>;
