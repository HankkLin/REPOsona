import { readFile } from "node:fs/promises";
import path from "node:path";
export async function GET() {
  const image = await readFile(path.resolve(process.env.OCTOCAT_REFERENCE_PATH || "red-polo.png"));
  return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
