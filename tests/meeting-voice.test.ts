import { expect, it, vi } from "vitest";
import { avatarDeliveryPrompt, AvatarVoiceSettings } from "@/components/meeting-voice";
import { createPersona } from "@/server/persona";

it("includes user voice direction within the Reactor prompt limit", async () => {
  const persona = await createPersona({ owner: "acme", name: "widget", url: "https://github.com/acme/widget", readme: "# Widget", sourceUrl: "", truncated: false }, true);
  persona.voice.direction = "Speak softly, with a curious British accent.";
  persona.speakingStyle = "x".repeat(500);
  const prompt = avatarDeliveryPrompt(persona);
  expect(prompt).toContain(persona.voice.direction);
  expect(prompt.length).toBeLessThanOrEqual(800);
  expect(prompt).toContain("non-human");
  expect(prompt).not.toContain(persona.speakingStyle);
});

it("does not reset the voice on every answer and updates pace when the direction changes", async () => {
  const persona = await createPersona({ owner: "acme", name: "widget", url: "https://github.com/acme/widget", readme: "# Widget", sourceUrl: "", truncated: false }, true);
  const model = { setPrompt: vi.fn().mockImplementation(async ({ prompt }) => ({ type: "prompt_accepted", prompt })), setWpm: vi.fn().mockImplementation(async ({ wpm }) => ({ type: "wpm_accepted", wpm })) };
  const settings = new AvatarVoiceSettings();
  await settings.apply(model, persona); await settings.apply(model, persona);
  expect(model.setPrompt).toHaveBeenCalledOnce(); expect(model.setWpm).toHaveBeenCalledOnce();
  const next = { ...persona, voice: { ...persona.voice, casting: "Her voice is a bright, ringing soprano with quick, crisp consonants.", wpm: 185 } };
  await settings.apply(model, next); await settings.apply(model, next);
  expect(model.setPrompt).toHaveBeenCalledTimes(2); expect(model.setWpm).toHaveBeenLastCalledWith({ wpm: 185 });
  expect(model.setPrompt.mock.calls[1][0].prompt).toContain(next.voice.casting);
});

it("does not cache settings rejected by Reactor", async () => {
  const persona = await createPersona({ owner: "acme", name: "widget", url: "https://github.com/acme/widget", readme: "# Widget", sourceUrl: "", truncated: false }, true);
  const model = { setPrompt: vi.fn().mockResolvedValue(undefined), setWpm: vi.fn() };
  const settings = new AvatarVoiceSettings();
  await expect(settings.apply(model, persona)).rejects.toThrow("voice casting");
  await expect(settings.apply(model, persona)).rejects.toThrow("voice casting");
  expect(model.setPrompt).toHaveBeenCalledTimes(2); expect(model.setWpm).not.toHaveBeenCalled();
});
