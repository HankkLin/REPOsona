import { expect, it } from "vitest";
import { captionAt, captionCues } from "@/components/meeting-captions";

it("advances through short cues and clears after the final line", () => {
  const script = "Welcome to the repository. This is a longer explanation that needs several short readable lines rather than one giant paragraph on the screen.";
  const cues = captionCues(script, 140);
  expect(cues.length).toBeGreaterThan(2);
  expect(cues.every(cue => cue.text.length <= 52)).toBe(true);
  expect(captionAt(cues, 0)).toBe("Welcome to the repository.");
  expect(captionAt(cues, cues[0].end)).toBe(cues[1].text);
  expect(captionAt(cues, cues.at(-1)!.end)).toBe("");
  expect(cues.map(cue => cue.text).join(" ")).toBe(script);
  expect(captionCues(script, 140, 30).every(cue => cue.text.length <= 30)).toBe(true);
});

it("uses speaking pace and avoids showing markdown formatting", () => {
  const slow = captionCues("**Hello there.**", 80);
  const fast = captionCues("Hello there.", 220);
  expect(slow[0].text).toBe("Hello there.");
  expect(slow[0].end).toBeGreaterThan(fast[0].end);
  expect(captionCues("  ", 140)).toEqual([]);
});
