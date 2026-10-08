import { describe, expect, it } from "vitest";
import { createPersona } from "@/server/persona";
import { editPersona, personaPatchSchema } from "@/server/persona-edit";

const repository = { owner: "acme", name: "widget", url: "https://github.com/acme/widget", readme: "# Widget", sourceUrl: "https://github.com/acme/widget/blob/main/README.md", truncated: false };

describe("persona editing", () => {
  it("merges edited sections and keeps generated voice delivery", async () => {
    const persona = await createPersona(repository, true);
    const edited = editPersona(persona, { goals: ["Ship it"], dna: { stability: 10, strictness: 90, playfulness: 50 }, voice: { tone: "Dry" } });
    expect(edited.goals).toEqual(["Ship it"]);
    expect(edited.dna?.strictness).toBe(90);
    expect(edited.voice).toMatchObject({ tone: "Dry", rate: persona.voice.rate, language: persona.voice.language });
    expect(edited.backstory).toBe(persona.backstory);
  });
  it("clears emptied optional text and rejects invalid edits", async () => {
    const persona = await createPersona(repository, true);
    expect(editPersona(persona, { archetype: "  " }).archetype).toBeUndefined();
    expect(() => editPersona(persona, { name: "" })).toThrow();
    expect(() => editPersona(persona, { traits: [] })).toThrow();
    expect(personaPatchSchema.safeParse({ visualPrompt: "x" }).success).toBe(false);
    expect(personaPatchSchema.safeParse({ voice: { rate: 2 } }).success).toBe(false);
  });
  it("saves and clears natural-language voice direction without changing other voice settings", async () => {
    const persona = await createPersona(repository, true);
    const edited = editPersona(persona, personaPatchSchema.parse({ voice: { direction: "  Warm and relaxed, with a soft British accent.  " } }));
    expect(edited.voice.direction).toBe("Warm and relaxed, with a soft British accent.");
    expect(edited.voice.rate).toBe(persona.voice.rate);
    expect(editPersona(edited, { voice: { direction: "" } }).voice.direction).toBe("");
    expect(personaPatchSchema.safeParse({ voice: { direction: "x".repeat(401) } }).success).toBe(false);
  });
});
