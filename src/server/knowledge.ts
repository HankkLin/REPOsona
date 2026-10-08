import { createHash } from "node:crypto";
import type { KnowledgeBase, KnowledgeChunk, Project, Repository } from "@/domain/schemas";
import { embedTexts } from "./providers/embeddings";
import { googleModels } from "./models";

export function readmeHash(readme: string) { return createHash("sha256").update(readme).digest("hex"); }
export function chunkReadme(readme: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  let text = ""; let startLine = 1; let endLine = 1;
  function flush() {
    if (text.trim()) chunks.push({ id: `readme-${chunks.length + 1}`, startLine, endLine, text });
    text = "";
  }
  readme.split("\n").forEach((line, index) => {
    // Splitting long lines preserves their original citation number.
    const pieces = line.length > 2400 ? line.match(/[\s\S]{1,2400}/g)! : [line];
    for (const piece of pieces) {
      if (text && (text.length + piece.length + 1 > 2400)) flush();
      if (!text) startLine = index + 1;
      text += `${text ? "\n" : ""}${piece}`; endLine = index + 1;
    }
  });
  flush(); return chunks;
}
export async function createKnowledgeBase(repository: Repository, demo: boolean): Promise<KnowledgeBase> {
  const chunks = chunkReadme(repository.readme);
  const embeddingModel = demo ? "demo-lexical" : googleModels().embeddings;
  if (!demo) {
    const vectors = await embedTexts(chunks.map(c => c.text), "RETRIEVAL_DOCUMENT", embeddingModel);
    chunks.forEach((chunk, i) => { chunk.embedding = vectors[i]; });
  }
  return { sourceHash: readmeHash(repository.readme), embeddingModel, chunks };
}
export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) throw new Error("Repository embeddings are incompatible. Reimport the repository.");
  const dot = a.reduce((sum, value, i) => sum + value * b[i], 0);
  const norm = Math.hypot(...a) * Math.hypot(...b);
  if (!norm || !Number.isFinite(norm)) throw new Error("Repository embedding is invalid. Reimport the repository.");
  return dot / norm;
}
export async function retrieveEvidence(project: Project, question: string, limit = 4): Promise<KnowledgeChunk[]> {
  const knowledge = project.knowledgeBase;
  if (!knowledge || knowledge.sourceHash !== readmeHash(project.repository.readme)) throw new Error("Repository knowledge is missing or stale. Reimport the repository.");
  if (project.demo) {
    const words = question.toLowerCase().match(/[a-z]{3,}/g) || [];
    return knowledge.chunks.map(chunk => ({ chunk, score: words.filter(w => chunk.text.toLowerCase().includes(w)).length })).sort((a, b) => b.score - a.score).slice(0, limit).map(r => r.chunk);
  }
  const [query] = await embedTexts([question], "RETRIEVAL_QUERY", knowledge.embeddingModel);
  return knowledge.chunks.map(chunk => {
    if (!chunk.embedding) throw new Error("Repository knowledge is incomplete. Reimport the repository.");
    return { chunk, score: cosineSimilarity(query, chunk.embedding) };
  }).sort((a, b) => b.score - a.score).slice(0, limit).map(r => r.chunk);
}
