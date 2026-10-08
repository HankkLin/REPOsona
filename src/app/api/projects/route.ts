import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fetchReadme, parseGitHubUrl } from "@/server/github";
import { createPersona } from "@/server/persona";
import { createKnowledgeBase } from "@/server/knowledge";
import { saveProject, publicProject } from "@/server/store";
import { checkOrigin, failure, readBody, sessionId } from "@/server/http";
import { logImport } from "@/server/diagnostics";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const requestId = randomUUID();
  let stage = "input";
  let repositoryUrl: string | undefined;
  let started = Date.now();
  async function completed() {
    await logImport({ requestId, repository: repositoryUrl, stage, status: "ok", durationMs: Date.now() - started });
    started = Date.now();
  }
  try {
    checkOrigin(request);
    const { url } = z.object({ url: z.string().max(500) }).parse(await readBody(request));
    repositoryUrl = parseGitHubUrl(url).url;
    const demo = process.env.DEMO_MODE !== "false";
    const ownerSession = await sessionId();
    stage = "readme";
    const repository = await fetchReadme(repositoryUrl, demo);
    await completed();
    stage = "persona";
    const persona = await createPersona(repository, demo);
    await completed();
    stage = "embeddings";
    const knowledgeBase = await createKnowledgeBase(repository, demo);
    await completed();
    stage = "save";
    const project = { id: randomUUID(), ownerSession, demo, repository, persona, knowledgeBase, avatars: [] };
    await saveProject(project);
    await completed();
    return NextResponse.json(publicProject(project));
  } catch (error) {
    // Validation errors can contain user input; record a fixed label for those.
    await logImport({ requestId, repository: repositoryUrl, stage, status: "error", durationMs: Date.now() - started, error: stage === "input" ? "Invalid repository request" : error instanceof Error ? error.message : "Import failed" });
    return failure(error);
  }
}
