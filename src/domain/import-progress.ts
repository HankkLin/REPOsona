import type { Project } from "./schemas";

export const importStages = ["readme", "persona", "embeddings", "avatar", "save"] as const;
export type ImportStage = typeof importStages[number];
export type ViewProject = Omit<Project, "ownerSession" | "knowledgeBase">;
export type ImportEvent = { type: "progress"; stage: ImportStage } | { type: "complete"; project: ViewProject } | { type: "error"; error: string };

export async function readImportProgress(response: Response, onProgress: (stage: ImportStage) => void): Promise<ViewProject> {
  if (!response.ok) throw new Error((await response.json()).error || "Repository import failed.");
  if (!response.body) throw new Error("Import progress is unavailable. Please retry.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let project: ViewProject | undefined;
  function consume(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as ImportEvent;
    if (event.type === "error") throw new Error(event.error);
    if (event.type === "progress") onProgress(event.stage);
    if (event.type === "complete") project = event.project;
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop()!;
      lines.forEach(consume);
      if (done) break;
    }
    consume(pending);
    if (!project) throw new Error("Import connection ended before completion. Please retry.");
    return project;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
