import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessionId: vi.fn(), loadProject: vi.fn(), transcribe: vi.fn() }));
vi.mock("@/server/http", async () => { const actual = await vi.importActual<typeof import("@/server/http")>("@/server/http"); return { ...actual, sessionId: mocks.sessionId }; });
vi.mock("@/server/store", () => ({ loadProject: mocks.loadProject }));
vi.mock("@/server/providers/transcription", () => ({ maxRecordingBytes: 5 * 1024 * 1024, transcribeQuestion: mocks.transcribe }));
import { POST } from "@/app/api/projects/[id]/transcription/route";

afterEach(() => vi.resetAllMocks());
function request(origin = "http://localhost:3000") {
  const form = new FormData(); form.append("audio", new File(["audio"], "question.wav", { type: "audio/wav" }));
  return new Request("http://localhost:3000/api/projects/project/transcription", { method: "POST", headers: { origin }, body: form });
}
const params = { params: Promise.resolve({ id: "project" }) };
describe("microphone endpoint ownership", () => {
  it("checks browser ownership before transmitting any recording to Google", async () => {
    mocks.sessionId.mockResolvedValue("current-session"); mocks.loadProject.mockRejectedValue(new Error("Project not found in this browser session."));
    const response = await POST(request(), params);
    expect(response.status).toBe(400); expect(mocks.loadProject).toHaveBeenCalledWith("project", "current-session"); expect(mocks.transcribe).not.toHaveBeenCalled();
  });
  it("rejects cross-origin recording uploads", async () => {
    expect((await POST(request("https://other.test"), params)).status).toBe(400);
    expect(mocks.loadProject).not.toHaveBeenCalled(); expect(mocks.transcribe).not.toHaveBeenCalled();
  });
  it.each([{ demo: true, approvedAvatarId: "avatar" }, { demo: false }])("requires live mode and an approved character", async project => {
    mocks.loadProject.mockResolvedValue(project);
    expect((await POST(request(), params)).status).toBe(400); expect(mocks.transcribe).not.toHaveBeenCalled();
  });
  it("transcribes an approved browser-owned project with no-store headers", async () => {
    mocks.loadProject.mockResolvedValue({ demo: false, approvedAvatarId: "avatar" }); mocks.transcribe.mockResolvedValue({ transcript: "How do I start?" });
    const response = await POST(request(), params);
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ transcript: "How do I start?" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
