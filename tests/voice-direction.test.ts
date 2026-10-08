import { afterEach, expect, it, vi } from "vitest";
import { createPersona } from "@/server/persona";
import { resolveVoiceDirection } from "@/server/voice-direction";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const repository = { owner: "acme", name: "widget", url: "https://github.com/acme/widget", readme: "# Widget", sourceUrl: "", truncated: false };
function provider(data: unknown) {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  const fetch = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] }));
  vi.stubGlobal("fetch", fetch); return fetch;
}

it("turns natural-language voice preferences into saved casting and measurable pace", async () => {
  const persona = await createPersona(repository, true);
  const mock = provider({ casting: "His voice is a low, chesty baritone with gravelly grain and long, deliberate vowels.", wpm: 95 });
  const result = await resolveVoiceDirection(persona, "Deep, gravelly and very slow", false);
  expect(result.voice.direction).toBe("Deep, gravelly and very slow");
  expect(result.voice.wpm).toBe(95); expect(result.voice.casting).toContain("baritone");
  expect(result.voice.language).toBe(persona.voice.language);
  const body = JSON.parse(mock.mock.calls[0][1].body);
  expect(body.systemInstruction.parts[0].text).toContain("third-person");
  expect(body.contents[0].parts[0].text).toContain("Deep, gravelly");
});

it("clears compiled settings when the direction is cleared and never calls a model in demo", async () => {
  const persona = await createPersona(repository, true);
  persona.voice.casting = "Low baritone"; persona.voice.wpm = 95;
  const mock = vi.fn(); vi.stubGlobal("fetch", mock);
  expect((await resolveVoiceDirection(persona, "", false)).voice.wpm).toBeUndefined();
  expect((await resolveVoiceDirection(persona, "", false)).voice.casting).toBeUndefined();
  await resolveVoiceDirection(persona, "bright", true); expect(mock).not.toHaveBeenCalled();
});

it("rejects invalid generated pace rather than pretending the voice was applied", async () => {
  const persona = await createPersona(repository, true); provider({ casting: "Low baritone", wpm: 1000 });
  await expect(resolveVoiceDirection(persona, "slow", false)).rejects.toThrow("invalid structured response");
});

it("uses the pulled acoustic-profile section when generating a new persona", async () => {
  const persona = await createPersona(repository, true);
  persona.voice.casting = "A bright tenor with clear consonants and a bouncy cadence."; persona.voice.wpm = 150;
  const mock = provider(persona);
  expect((await createPersona(repository, false)).voice.casting).toBe(persona.voice.casting);
  const body = JSON.parse(mock.mock.calls[0][1].body);
  expect(body.systemInstruction.parts[0].text).toContain("Voice & Acoustic Profile");
  expect(body.systemInstruction.parts[0].text).toContain("Pitch & Timbre");
});
