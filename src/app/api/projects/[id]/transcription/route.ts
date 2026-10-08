import { NextResponse } from "next/server";
import { checkOrigin, failure, sessionId } from "@/server/http";
import { loadProject } from "@/server/store";
import { maxRecordingBytes, transcribeQuestion } from "@/server/providers/transcription";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const project = await loadProject((await params).id, await sessionId());
    if (project.demo) throw new Error("Microphone questions require live mode. You can still type a question.");
    if (!project.approvedAvatarId) throw new Error("Confirm your avatar before asking a microphone question.");
    if (Number(request.headers.get("content-length")) > maxRecordingBytes + 65536) throw new Error("Recording is too large.");
    const audio = (await request.formData()).get("audio");
    if (!(audio instanceof File)) throw new Error("Attach an audio recording.");
    return NextResponse.json(await transcribeQuestion(audio), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
