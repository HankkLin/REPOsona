import type { Persona } from "@/domain/schemas";

export function avatarDeliveryPrompt(persona: Persona): string {
  const casting = persona.voice.casting || persona.voice.direction?.trim() || `The speaker has a ${persona.voice.tone} voice.`;
  const legacyDelivery = persona.voice.casting || persona.voice.direction?.trim() ? "" : persona.speakingStyle;
  return `${casting} The non-human repository mascot speaks directly to the camera in ${persona.voice.language}, with subtle gestures. ${legacyDelivery}`.slice(0, 800).trim();
}

export function avatarWpm(persona: Persona): number {
  return persona.voice.wpm ?? Math.round(Math.min(220, Math.max(80, persona.voice.rate * 140)));
}

export class AvatarVoiceSettings {
  private applied: { prompt: string; wpm: number } | undefined;
  async apply(client: Pick<import("@reactor-models/ltx2/core").Ltx2Model, "setPrompt" | "setWpm">, persona: Persona) {
    const prompt = avatarDeliveryPrompt(persona); const wpm = avatarWpm(persona);
    const changed = this.applied?.prompt !== prompt || this.applied?.wpm !== wpm;
    // Repeated setPrompt resets LTX's voice. Send only actual changes.
    if (this.applied?.prompt !== prompt) {
      const accepted = await client.setPrompt({ prompt });
      if (!accepted || accepted.prompt !== prompt) throw new Error("Reactor did not confirm the requested voice casting.");
    }
    if (this.applied?.wpm !== wpm) {
      const accepted = await client.setWpm({ wpm });
      if (!accepted || accepted.wpm !== wpm) throw new Error("Reactor did not confirm the requested speaking pace.");
    }
    this.applied = { prompt, wpm };
    if (changed) console.info("[reactor-voice]", JSON.stringify({ outcome: "accepted", wpm, promptCharacters: prompt.length }));
  }
}
