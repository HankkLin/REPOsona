import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { fetchReadme, parseGitHubUrl } from "@/server/github";
import { createPersona } from "@/server/persona";
import { personaMarkdown } from "@/server/persona-markdown";
import { answerQuestion } from "@/server/chat";
import { createAvatar } from "@/server/providers/image";
import { createReactorSession } from "@/server/providers/reactor";
import { loadProject, saveProject } from "@/server/store";
import type { Project } from "@/domain/schemas";

describe("repository ingestion", () => {
  it("normalizes repository URLs", () => { expect(parseGitHubUrl("https://github.com/vercel/next.js.git/").url).toBe("https://github.com/vercel/next.js"); });
  it.each(["http://github.com/a/b", "https://github.com.evil.test/a/b", "https://github.com/a/b/tree/main", "https://user@github.com/a/b", "https://github.com:444/a/b", "https://github.com/a/.git", "file:///etc/passwd"])("rejects invalid or unsafe URL %s", input => { expect(() => parseGitHubUrl(input)).toThrow(); });
});

async function fixture(): Promise<Project> {
  const repository = await fetchReadme("https://github.com/acme/toolkit", true);
  return { id: randomUUID(), ownerSession: randomUUID(), demo: true, repository, persona: await createPersona(repository, true), avatars: [] };
}
describe("demo journey", () => {
  it("labels fixture content and exports persona grounding rules", async () => {
    const project = await fixture();
    expect(project.repository.readme).toContain("demo README, not fetched content");
    expect(personaMarkdown(project.persona)).toContain("personality never overrides accuracy");
  });
  it("returns source lines for matching questions and admits missing knowledge", async () => {
    const project = await fixture();
    const answer = await answerQuestion(project, "How do I install dependencies?");
    expect(answer.answer).toContain("npm install");
    expect(answer.citations.length).toBeGreaterThan(0);
    for (const citation of answer.citations) expect(project.repository.readme.split("\n")[citation.startLine - 1]).toBeTruthy();
    expect((await answerQuestion(project, "Does it support Kubernetes?")).citations).toEqual([]);
  });
  it("requires approval before creating an interactive session", async () => {
    const project = await fixture();
    await expect(createReactorSession(project)).rejects.toThrow("Approve");
    const avatar = await createAvatar(project, "A teal hoodie");
    expect(avatar.image).toMatch(/^data:image\/svg\+xml;base64,/);
    project.avatars.push(avatar); project.approvedAvatarId = avatar.id;
    expect(await createReactorSession(project)).toEqual({ mode: "demo" });
  });
  it("persists a project while preventing access by another session", async () => {
    const project = await fixture(); await saveProject(project);
    expect((await loadProject(project.id, project.ownerSession)).persona.name).toBe(project.persona.name);
    await expect(loadProject(project.id, randomUUID())).rejects.toThrow("not found");
    await expect(loadProject("../../etc/passwd", project.ownerSession)).rejects.toThrow("not found");
  });
});
