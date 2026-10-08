import { NextResponse } from "next/server";
import { z } from "zod";
import { editPersona, personaPatchSchema } from "@/server/persona-edit";
import { loadProject, saveProject, publicProject } from "@/server/store";
import { checkOrigin, failure, readBody, sessionId } from "@/server/http";
import { createAvatar } from "@/server/providers/image";
import { createReactorSession } from "@/server/providers/reactor";
import { answerQuestion } from "@/server/chat";
import { createKnowledgeBase, readmeHash } from "@/server/knowledge";
import { synthesizeSpeech } from "@/server/providers/speech";

export const runtime = "nodejs";
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("persona"), persona: personaPatchSchema }),
  z.object({ action: z.literal("generate"), suggestion: z.string().max(1000).default("") }),
  z.object({ action: z.literal("approve"), avatarId: z.string().uuid() }),
  z.object({ action: z.literal("chat"), question: z.string().trim().min(1).max(2000), mode: z.enum(["flash", "pro"]).default("flash") }),
  z.object({ action: z.literal("speech"), text: z.string().trim().min(1).max(10000) }),
  z.object({ action: z.literal("session") }),
]);
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const input = actionSchema.parse(await readBody(request));
    const project = await loadProject((await params).id, await sessionId());
    if (input.action === "chat") {
      // Existing projects are migrated lazily without changing their persona or avatars.
      if (!project.knowledgeBase || project.knowledgeBase.sourceHash !== readmeHash(project.repository.readme)) {
        project.knowledgeBase = await createKnowledgeBase(project.repository, project.demo);
        await saveProject(project);
      }
      return NextResponse.json(await answerQuestion(project, input.question, input.mode), { headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "speech") return NextResponse.json(await synthesizeSpeech(project, input.text), { headers: { "Cache-Control": "no-store" } });
    if (input.action === "session") return NextResponse.json(await createReactorSession(project), { headers: { "Cache-Control": "no-store" } });
    if (input.action === "persona") {
      project.persona = editPersona(project.persona, input.persona);
    } else if (input.action === "generate") {
      if (project.avatars.length >= 20) throw new Error("This starter supports 20 avatar versions per project.");
      project.avatars.push(await createAvatar(project, input.suggestion));
      project.approvedAvatarId = undefined;
    } else {
      if (!project.avatars.some(a => a.id === input.avatarId)) throw new Error("Choose an existing avatar.");
      project.approvedAvatarId = input.avatarId;
    }
    await saveProject(project);
    return NextResponse.json(publicProject(project));
  } catch (error) { return failure(error); }
}
