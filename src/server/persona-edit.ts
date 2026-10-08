import { z } from "zod";
import { personaSchema, type Persona } from "@/domain/schemas";

// Fields a person may edit on the persona card. Voice delivery (rate, pitch, language) stays generated.
export const personaPatchSchema = personaSchema
  .pick({ name: true, tagline: true, backstory: true, traits: true, convictions: true, speakingStyle: true, archetype: true, audience: true, goals: true, frustrations: true, dna: true })
  .extend({ voice: personaSchema.shape.voice.pick({ tone: true, name: true }).partial().strict() })
  .partial()
  .strict();
export type PersonaPatch = z.infer<typeof personaPatchSchema>;

export function editPersona(persona: Persona, patch: PersonaPatch): Persona {
  const { voice, ...fields } = patch;
  const merged = { ...persona, ...fields, voice: { ...persona.voice, ...voice } };
  // An emptied optional text field clears it rather than storing "".
  if (!merged.archetype?.trim()) delete merged.archetype;
  if (!merged.audience?.trim()) delete merged.audience;
  return personaSchema.parse(merged);
}
