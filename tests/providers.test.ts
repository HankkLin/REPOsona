import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchReadme } from "@/server/github";
import { createPersona } from "@/server/persona";
import { createAvatar } from "@/server/providers/image";
import { createReactorSession } from "@/server/providers/reactor";
import { answerQuestion } from "@/server/chat";
import type { Project } from "@/domain/schemas";
import { chunkReadme, readmeHash } from "@/server/knowledge";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function project(): Promise<Project> {
  const repository = await fetchReadme("https://github.com/acme/toolkit", true);
  return { id: "fixture", ownerSession: "session", demo: false, repository, persona: await createPersona(repository, true), avatars: [], knowledgeBase: { sourceHash: readmeHash(repository.readme), embeddingModel: "gemini-embedding-001", chunks: chunkReadme(repository.readme).map(chunk => ({ ...chunk, embedding: [1, ...Array(767).fill(0)] })) } };
}
describe("provider contracts", () => {
  it("imports GitHub's actual README filename and reports truncation", async () => {
    const mock = vi.fn().mockResolvedValue(Response.json({ encoding: "base64", content: Buffer.from("a".repeat(60001)).toString("base64"), size: 60001, html_url: "https://github.com/acme/toolkit/blob/main/Readme.rst" }));
    vi.stubGlobal("fetch", mock);
    const repo = await fetchReadme("https://github.com/acme/toolkit", false);
    expect(repo.truncated).toBe(true); expect(repo.readme.length).toBe(60000);
    expect(repo.sourceUrl).toContain("Readme.rst"); expect(mock.mock.calls[0][0]).toBe("https://api.github.com/repos/acme/toolkit/readme");
  });
  it("uses only the previous character for refinement and skips thinking images", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const mock = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ thought: true, inlineData: { mimeType: "image/png", data: "thinking" } }, { inlineData: { mimeType: "image/png", data: "final" } }] } }] }));
    vi.stubGlobal("fetch", mock);
    const p = await project(); p.avatars = [{ id: "previous", image: "data:image/png;base64,previous", suggestion: "blue hoodie", createdAt: "" }];
    expect((await createAvatar(p, "add glasses")).image).toBe("data:image/png;base64,final");
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.contents[0].parts).toHaveLength(2);
    expect(body.contents[0].parts[1].inlineData.data).toBe("previous");
    expect(body.contents[0].parts[0].text).toContain("blue hoodie");
    expect(mock.mock.calls[0][0]).toContain("gemini-nano-banana-2.1");
  });
  it("creates the initial character without a mascot reference", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const mock = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "final" } }] } }] }));
    vi.stubGlobal("fetch", mock);
    await createAvatar(await project(), "");
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.contents[0].parts).toHaveLength(1);
    expect(body.systemInstruction.parts[0].text).toContain("Create a persona with an accompanying image");
    expect(JSON.parse(body.contents[0].parts[0].text).repository.readme).toContain("demo README");
  });
  it("rejects model citations outside the ingested README", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith(":batchEmbedContents") ? Response.json({ embeddings: [{ values: [1, ...Array(767).fill(0)] }] }) : Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "Unsupported", citations: [{ startLine: 1, endLine: 999 }] }) }] } }] }))));
    await expect(answerQuestion(await project(), "How do I start?")).rejects.toThrow("invalid citations");
  });
  it("mints a short-lived token scoped to one LTX session", async () => {
    vi.stubEnv("REACTOR_API_KEY", "test-key");
    const mock = vi.fn().mockResolvedValue(Response.json({ jwt: "scoped-jwt", expires_at: 1800000000 })); vi.stubGlobal("fetch", mock);
    const p = await project(); p.approvedAvatarId = "approved";
    expect(await createReactorSession(p)).toEqual({ mode: "live", jwt: "scoped-jwt", expiresAt: 1800000000 });
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body.authorization_details[0].resources.models.match).toEqual(["reactor/ltx2"]);
    expect(body.authorization_details[0].constraints.max_sessions).toBe(1);
    expect(body.expires_after).toBe(900);
  });
});
