import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type ImportEvent = {
  requestId: string;
  repository?: string;
  stage: string;
  status: "ok" | "error";
  durationMs: number;
  error?: string;
};

// Record import metadata only: never credentials, cookies, prompts, or README text.
export async function logImport(event: ImportEvent) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event });
  console.info(`[repository-import] ${line}`);
  try {
    const directory = path.join(process.cwd(), ".data", "logs");
    await mkdir(directory, { recursive: true });
    await appendFile(path.join(directory, "imports.jsonl"), `${line}\n`, "utf8");
  } catch {
    console.warn("Could not persist repository import diagnostics.");
  }
}
