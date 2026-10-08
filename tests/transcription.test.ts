import { afterEach, describe, expect, it, vi } from "vitest";
import { maxRecordingBytes, transcribeQuestion } from "@/server/providers/transcription";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("microphone transcription", () => {
  it("uses the configured Google model for audio and returns a question without answering it", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubEnv("GEMINI_TEXT_MODEL", "configured-flash");
    const mock = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: '{"transcript":"How do I get started?"}' }] } }] }));
    vi.stubGlobal("fetch", mock);
    expect(await transcribeQuestion(new File(["audio"], "question", { type: "audio/webm;codecs=opus" }))).toEqual({ transcript: "How do I get started?" });
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(mock.mock.calls[0][0]).toContain("configured-flash");
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe("audio/webm");
    expect(body.systemInstruction.parts[0].text).toContain("Do not answer");
  });
  it("rejects empty, oversized and unsupported uploads before calling a model", async () => {
    const mock = vi.fn(); vi.stubGlobal("fetch", mock);
    await expect(transcribeQuestion(new File([], "empty", { type: "audio/wav" }))).rejects.toThrow("shorter than one minute");
    await expect(transcribeQuestion(new File([new Uint8Array(maxRecordingBytes + 1)], "large", { type: "audio/wav" }))).rejects.toThrow("shorter than one minute");
    await expect(transcribeQuestion(new File(["text"], "file", { type: "text/plain" }))).rejects.toThrow("unsupported");
    expect(mock).not.toHaveBeenCalled();
  });
  it("does not turn silence into an invented question", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: '{"transcript":""}' }] } }] })));
    await expect(transcribeQuestion(new File(["audio"], "question", { type: "audio/wav" }))).rejects.toThrow("No speech");
  });
});
