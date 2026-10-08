import type { Repository } from "@/domain/schemas";

export function parseGitHubUrl(input: string) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("Paste a valid https://github.com/owner/repository URL."); }
  const parts = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || parts.length !== 2 || !parts.every(p => /^[\w.-]+$/.test(p)) || parts.some(p => p === "." || p === "..")) {
    throw new Error("Use the repository root URL: https://github.com/owner/repository.");
  }
  const [owner, rawName] = parts;
  const name = rawName.replace(/\.git$/, "");
  if (!name) throw new Error("Repository name is missing.");
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}

export async function fetchReadme(input: string, demo: boolean): Promise<Repository> {
  const repo = parseGitHubUrl(input);
  if (demo) return { ...repo, sourceUrl: `${repo.url}/blob/HEAD/README.md`, truncated: false, readme: `# ${repo.name}\n\nThis is a demo README, not fetched content from ${repo.url}.\n\n## Purpose\nA small toolkit for making complex developer workflows feel simple.\n\n## Getting started\nInstall dependencies with npm install, then run npm run dev.\n\n## Philosophy\nPrefer clear APIs, readable code, and small composable pieces.\n\n## Contributions\nOpen an issue to discuss a change before sending a pull request.` };
  const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/readme`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(20000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Repository or README not found. This starter supports public repositories." : `GitHub could not load the README (${response.status}). Check access or rate limits.`);
  const data = await response.json();
  if (data.encoding !== "base64" || typeof data.content !== "string") throw new Error("GitHub did not return a readable README.");
  if (data.size > 1_000_000) throw new Error("README exceeds the 1 MB import limit.");
  const readme = Buffer.from(data.content, "base64").toString("utf8");
  if (!readme.trim()) throw new Error("The repository README is empty.");
  return { ...repo, readme: readme.slice(0, 60000), sourceUrl: data.html_url, truncated: readme.length > 60000 };
}
