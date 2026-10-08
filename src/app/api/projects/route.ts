import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fetchReadme, parseGitHubUrl } from "@/server/github";
import { createPersona } from "@/server/persona";
import { createKnowledgeBase } from "@/server/knowledge";
import { createAvatar } from "@/server/providers/image";
import { saveProject, publicProject } from "@/server/store";
import { checkOrigin, failure, readBody, sessionId } from "@/server/http";
import { logImport } from "@/server/diagnostics";
import type { ImportEvent, ImportStage } from "@/domain/import-progress";
import type { Project } from "@/domain/schemas";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const requestId = randomUUID();
  let stage: ImportStage | "input" = "input";
  let repositoryUrl: string | undefined;
  let started = Date.now();
  async function failed(error: unknown) {
    const response = failure(error);
    const { error: message } = await response.clone().json();
    await logImport({ requestId, repository: repositoryUrl, stage, status: "error", durationMs: Date.now() - started, error: stage === "input" ? "Invalid repository request" : message });
    return response;
  }
  try {
    checkOrigin(request);
    const { url } = z.object({ url: z.string().max(500) }).parse(await readBody(request));
    repositoryUrl = parseGitHubUrl(url).url;
    const demo = process.env.DEMO_MODE !== "false";
    // Set the ownership cookie before starting a streamed response.
    const ownerSession = await sessionId();
    async function build(emit: (event: ImportEvent) => void) {
      async function step<T>(name: ImportStage, task: () => Promise<T>) {
        stage = name; started = Date.now(); emit({ type: "progress", stage: name });
        const value = await task();
        await logImport({ requestId, repository: repositoryUrl, stage, status: "ok", durationMs: Date.now() - started });
        return value;
      }
      const repository = await step("readme", () => fetchReadme(repositoryUrl!, demo));
      const persona = await step("persona", () => createPersona(repository, demo));
      const knowledgeBase = await step("embeddings", () => createKnowledgeBase(repository, demo));
      const project: Project = { id: randomUUID(), ownerSession, demo, repository, persona, knowledgeBase, avatars: [] };
      project.avatars.push(await step("avatar", () => createAvatar(project, "")));
      await step("save", () => saveProject(project));
      return publicProject(project);
    }
    if (!request.headers.get("accept")?.includes("application/x-ndjson")) return NextResponse.json(await build(() => undefined));
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: ImportEvent) => { if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
        try { emit({ type: "complete", project: await build(emit) }); }
        catch (error) { const response = await failed(error); emit({ type: "error", error: (await response.json()).error }); }
        finally { if (!cancelled) controller.close(); }
      },
      cancel() { cancelled = true; },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch (error) { return failed(error); }
}
