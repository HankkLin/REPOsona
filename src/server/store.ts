import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Project } from "@/domain/schemas";

const directory = path.join(process.cwd(), ".data", "projects");
export async function saveProject(project: Project) {
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, `${project.id}.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(project), { mode: 0o600 });
  await rename(temporary, target);
}
export async function loadProject(id: string, session: string): Promise<Project> {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Project not found.");
  let project: Project;
  try { project = JSON.parse(await readFile(path.join(directory, `${id}.json`), "utf8")); } catch { throw new Error("Project not found."); }
  if (project.ownerSession !== session) throw new Error("Project not found in this browser session.");
  return project;
}
export function publicProject({ ownerSession: _owner, knowledgeBase: _knowledge, ...project }: Project) { return project; }
