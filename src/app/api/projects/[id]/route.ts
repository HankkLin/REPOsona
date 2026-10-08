import { NextResponse } from "next/server";
import { loadProject, publicProject } from "@/server/store";
import { failure, sessionId } from "@/server/http";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(publicProject(await loadProject((await params).id, await sessionId())), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
