import type { Persona } from "@/domain/schemas";

const list = (items: string[] = []) => items.map(t => `- ${t}`).join("\n");

export function personaMarkdown(persona: Persona) {
  const profile = [
    persona.archetype && `**Archetype:** ${persona.archetype}`,
    persona.audience && `**Who I'm for:** ${persona.audience}`,
  ].filter(Boolean).join("\n\n");
  const research = [
    profile && `## Profile\n${profile}`,
    persona.goals?.length && `## Goals\n${list(persona.goals)}`,
    persona.frustrations?.length && `## Frustrations\n${list(persona.frustrations)}`,
    persona.dna && `## Repo DNA spectrum\n- Experimental → Stable: ${persona.dna.stability}/100\n- Flexible → Strict: ${persona.dna.strictness}/100\n- Formal → Playful: ${persona.dna.playfulness}/100`,
  ].filter(Boolean).map(section => `${section}\n\n`).join("");
  return `# ${persona.name}\n\n> ${persona.tagline}\n\n${research}## Fictional backstory\n${persona.backstory}\n\n## Repo DNA\n${list(persona.traits)}\n\n## Convictions\n${list(persona.convictions)}\n\n## Speaking style\n${persona.speakingStyle}\n\n## Voice\n${persona.voice.name || "Stable repository stock voice"}; ${persona.voice.tone}; ${persona.voice.language}; rate ${persona.voice.rate}; pitch ${persona.voice.pitch}${persona.voice.direction ? `\nVoice direction: ${persona.voice.direction}` : ""}${persona.voice.casting ? `\nAcoustic casting: ${persona.voice.casting}` : ""}${persona.voice.wpm ? `\nSpeaking pace: ${persona.voice.wpm} WPM` : ""}\n\n## Avatar direction\n${persona.visualPrompt}\n\n## Grounding rule\nAnswer repository questions using README evidence. Cite lines. Acknowledge missing information; personality never overrides accuracy.\n`;
}
