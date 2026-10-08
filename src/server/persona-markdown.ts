import type { Persona } from "@/domain/schemas";

export function personaMarkdown(persona: Persona) {
  return `# ${persona.name}\n\n> ${persona.tagline}\n\n## Fictional backstory\n${persona.backstory}\n\n## Repo DNA\n${persona.traits.map(t => `- ${t}`).join("\n")}\n\n## Convictions\n${persona.convictions.map(t => `- ${t}`).join("\n")}\n\n## Speaking style\n${persona.speakingStyle}\n\n## Voice\n${persona.voice.name || "Stable repository stock voice"}; ${persona.voice.tone}; ${persona.voice.language}; rate ${persona.voice.rate}; pitch ${persona.voice.pitch}\n\n## Avatar direction\n${persona.visualPrompt}\n\n## Grounding rule\nAnswer repository questions using README evidence. Cite lines. Acknowledge missing information; personality never overrides accuracy.\n`;
}
