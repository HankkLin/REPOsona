import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/domain/schemas";
import { createPersona } from "@/server/persona";
import { fetchReadme } from "@/server/github";
import { answerQuestion } from "@/server/chat";
import { chunkReadme, createKnowledgeBase, readmeHash, retrieveEvidence } from "@/server/knowledge";
import { publicProject } from "@/server/store";
import { synthesizeSpeech, voiceName } from "@/server/providers/speech";
import { embedTexts } from "@/server/providers/embeddings";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const vector = (axis = 0) => Array.from({ length: 768 }, (_, i) => Number(i === axis));
async function fixture(): Promise<Project> {
  const repository = await fetchReadme("https://github.com/acme/toolkit", true);
  return { id: "project", ownerSession: "owner", demo: false, repository, persona: await createPersona(repository, true), avatars: [], knowledgeBase: { sourceHash: readmeHash(repository.readme), embeddingModel: "stored-embedding-model", chunks: chunkReadme(repository.readme).map(c => ({ ...c, embedding: vector() })) } };
}

describe("repository retrieval", () => {
  it("chunks long lines without losing source line numbers", () => {
    const chunks = chunkReadme("x".repeat(5000) + "\nfinal");
    expect(chunks.every(c => c.text.length <= 2400)).toBe(true);
    expect(chunks[0].startLine).toBe(1); expect(chunks[1].endLine).toBe(1);
    expect(chunks.at(-1)?.endLine).toBe(2); expect(chunks.at(-1)?.text).toContain("final");
  });
  it("indexes documents with Google and stores the chosen model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubEnv("GEMINI_EMBEDDING_MODEL", "configured-embedding-model");
    const mock = vi.fn().mockResolvedValue(Response.json({ embeddings: [{ values: vector() }] })); vi.stubGlobal("fetch", mock);
    const p = await fixture(); const knowledge = await createKnowledgeBase(p.repository, false);
    expect(knowledge.embeddingModel).toBe("configured-embedding-model"); expect(knowledge.chunks[0].embedding).toEqual(vector());
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.requests[0].embedContentConfig).toEqual({ taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768 });
  });
  it("retrieves from only the current project's index using its stored model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const mock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ embeddings: [{ values: vector(1) }] }))); vi.stubGlobal("fetch", mock);
    const first = await fixture(); const second = await fixture();
    first.knowledgeBase!.chunks = [{ id: "a", startLine: 1, endLine: 1, text: "First repository", embedding: vector(1) }];
    second.knowledgeBase!.chunks = [{ id: "b", startLine: 1, endLine: 1, text: "Second repository", embedding: vector(1) }];
    expect((await retrieveEvidence(first, "question"))[0].text).toBe("First repository");
    expect((await retrieveEvidence(second, "question"))[0].text).toBe("Second repository");
    expect(mock.mock.calls[0][0]).toContain("stored-embedding-model");
    expect(publicProject(first)).not.toHaveProperty("knowledgeBase");
    expect(publicProject(first)).not.toHaveProperty("ownerSession");
  });
  it("refuses stale knowledge and malformed embedding responses", async () => {
    const p = await fixture(); p.repository.readme += "changed";
    await expect(retrieveEvidence(p, "question")).rejects.toThrow("stale");
    vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ embeddings: [{ values: [0] }] })));
    await expect(embedTexts(["hello"], "RETRIEVAL_QUERY", "model")).rejects.toThrow("invalid repository embeddings");
  });
  it.each(["flash", "pro"] as const)("routes %s answers to the configured Google model with retrieved evidence", async mode => {
    vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubEnv("GEMINI_TEXT_MODEL", "configured-flash"); vi.stubEnv("GEMINI_PRO_MODEL", "configured-pro");
    const mock = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith(":batchEmbedContents") ? Response.json({ embeddings: [{ values: vector() }] }) : Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "A demo toolkit.", citations: [{ startLine: 1, endLine: 1 }] }) }] } }] })));
    vi.stubGlobal("fetch", mock);
    await answerQuestion(await fixture(), "What is this?", mode);
    const generation = mock.mock.calls.find(c => c[0].includes(":generateContent"))!;
    expect(generation[0]).toContain(`configured-${mode}`);
    const prompt = JSON.parse(JSON.parse(generation[1].body).contents[0].parts[0].text);
    expect(prompt.evidence).toHaveLength(1); expect(prompt).not.toHaveProperty("readme");
  });
  it("rejects citations to lines outside the retrieved excerpts even when in the README", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith(":batchEmbedContents") ? Response.json({ embeddings: [{ values: vector() }] }) : Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "Unsupported", citations: [{ startLine: 4, endLine: 4 }] }) }] } }] }))));
    const p = await fixture(); p.knowledgeBase!.chunks = [{ id: "only-line-one", text: "# toolkit", startLine: 1, endLine: 1, embedding: vector() }];
    await expect(answerQuestion(p, "question")).rejects.toThrow("invalid citations");
  });
});

describe("Gemini persona speech", () => {
  function wave() {
    const data = Buffer.alloc(44); data.write("RIFF", 0); data.write("WAVE", 8); return data.toString("base64");
  }
  it("keeps the answer verbatim and voice instructions in structured metadata", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubEnv("GEMINI_TTS_MODEL", "configured-tts");
    const mock = vi.fn().mockResolvedValue(Response.json({ steps: [{ type: "model_output", content: [{ type: "audio", data: wave() }] }] })); vi.stubGlobal("fetch", mock);
    const p = await fixture(); const result = await synthesizeSpeech(p, "Install dependencies.");
    expect(result.mode).toBe("live"); expect(result).toHaveProperty("audio", `data:audio/wav;base64,${wave()}`);
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.model).toBe("configured-tts"); expect(body.input[0].content[0].text).toBe("Install dependencies.");
    expect(body.input[0].content[0].annotations[0].style).toContain(p.persona.voice.tone);
    expect(body.generation_config.speech_config[0].voice).toBe("Aoede");
  });
  it("selects a stable stock voice for old personas and does not silently fall back on failures", async () => {
    const p = await fixture(); delete p.persona.voice.name;
    expect(voiceName(p)).toBe(voiceName(p));
    vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    await expect(synthesizeSpeech(p, "hello")).rejects.toThrow("429");
  });
  it("does not call a provider in demo mode", async () => {
    const mock = vi.fn(); vi.stubGlobal("fetch", mock); const p = await fixture(); p.demo = true;
    expect(await synthesizeSpeech(p, "hello")).toEqual({ mode: "demo" }); expect(mock).not.toHaveBeenCalled();
  });
});
