import { describe, expect, it, vi } from "vitest";
import { readImportProgress } from "@/domain/import-progress";

function response(parts: string[]) {
  return new Response(new ReadableStream({ start(controller) { parts.forEach(p => controller.enqueue(new TextEncoder().encode(p))); controller.close(); } }));
}
describe("streamed import progress", () => {
  it("handles events split across network chunks and a final line without a newline", async () => {
    const progress = vi.fn();
    const result = await readImportProgress(response(['{"type":"pro', 'gress","stage":"readme"}\n{"type":"progress","stage":"avatar"}\n', '{"type":"complete","project":{"id":"created"}}']), progress);
    expect(progress.mock.calls).toEqual([["readme"], ["avatar"]]);
    expect(result.id).toBe("created");
  });
  it("surfaces provider errors inside an HTTP 200 stream", async () => {
    await expect(readImportProgress(response(['{"type":"progress","stage":"avatar"}\n{"type":"error","error":"Image quota exceeded"}\n']), vi.fn())).rejects.toThrow("Image quota exceeded");
  });
  it("does not mistake a broken stream for a successful import", async () => {
    await expect(readImportProgress(response(['{"type":"progress","stage":"persona"}\n']), vi.fn())).rejects.toThrow("before completion");
  });
  it("surfaces input failures before streaming begins", async () => {
    await expect(readImportProgress(Response.json({ error: "Invalid repository" }, { status: 400 }), vi.fn())).rejects.toThrow("Invalid repository");
  });
});
