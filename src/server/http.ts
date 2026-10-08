import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function sessionId() {
  const jar = await cookies();
  const existing = jar.get("repo-session")?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const id = randomUUID();
  jar.set("repo-session", id, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return id;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const url = new URL(request.url);
  // Next.js may construct request.url from its internal bind address. The Host
  // header is the authority the browser requested; do not trust forwarded hosts.
  const expectedHost = request.headers.get("host") || url.host;
  let supplied: URL;
  try { supplied = new URL(origin); } catch { throw new Error("Cross-origin requests are not allowed."); }
  if (supplied.origin !== origin || supplied.host !== expectedHost || supplied.protocol !== url.protocol) throw new Error("Cross-origin requests are not allowed.");
}
export async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 12000) throw new Error("Request is too large.");
  try { return JSON.parse(text); } catch { throw new Error("Request must contain valid JSON."); }
}
export function failure(error: unknown) {
  const message = error instanceof ZodError ? "Please check your input." : error instanceof Error ? error.message : "Something went wrong. Please retry.";
  return NextResponse.json({ error: message }, { status: 400 });
}
