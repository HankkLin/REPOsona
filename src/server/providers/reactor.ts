import { z } from "zod";
import type { Project } from "@/domain/schemas";

export async function createReactorSession(project: Project) {
  if (!project.approvedAvatarId) throw new Error("Approve an avatar before starting a conversation.");
  if (project.demo) return { mode: "demo" as const };
  if (!process.env.REACTOR_API_KEY) throw new Error("Configure REACTOR_API_KEY to activate the interactive avatar. README chat remains available.");
  const response = await fetch("https://api.reactor.inc/tokens", {
    method: "POST", headers: { "Content-Type": "application/json", "Reactor-API-Key": process.env.REACTOR_API_KEY },
    body: JSON.stringify({ expires_after: 900, authorization_details: [{ type: "session", resources: { models: { match: ["reactor/ltx2"] } }, constraints: { max_sessions: 1, max_session_duration_seconds: 600 } }] }),
    signal: AbortSignal.timeout(20000), redirect: "error",
  });
  if (!response.ok) throw new Error(`Reactor token request failed (${response.status}). Check model access and credentials.`);
  const token = z.object({ jwt: z.string().min(1), expires_at: z.number() }).parse(await response.json());
  return { mode: "live" as const, jwt: token.jwt, expiresAt: token.expires_at };
}
