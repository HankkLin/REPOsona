import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fetchReadme } from "@/server/github";
import { createPersona } from "@/server/persona";
import { createKnowledgeBase } from "@/server/knowledge";
import { saveProject, publicProject } from "@/server/store";
import { checkOrigin, failure, readBody, sessionId } from "@/server/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { url } = z.object({ url: z.string().max(500) }).parse(await readBody(request));
    const demo = process.env.DEMO_MODE !== "false";
    const ownerSession = await sessionId();
    const repository = await fetchReadme(url, demo);
    const persona = await createPersona(repository, demo);
    const knowledgeBase = await createKnowledgeBase(repository, demo);
    const project = { id: randomUUID(), ownerSession, demo, repository, persona, knowledgeBase, avatars: [] };
    await saveProject(project);
    return NextResponse.json(publicProject(project));
  } catch (error) { return failure(error); }
}
