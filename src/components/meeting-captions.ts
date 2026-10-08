export type CaptionCue = { text: string; start: number; end: number };

// Estimate cues from LTX's script pace; advance against the playback clock.
export function captionCues(script: string, wpm: number, maxCharacters = 52): CaptionCue[] {
  const words = script.replace(/```(?:\w+)?\n?/g, "").replace(/[*#`]/g, "").trim().split(/\s+/).filter(Boolean);
  const cues: CaptionCue[] = [];
  const secondsPerWord = 60 / Math.max(80, Math.min(220, wpm));
  let start = 0;
  let line: string[] = [];
  for (const word of words) {
    if (line.length && (line.join(" ").length + word.length + 1 > maxCharacters || line.length >= 9)) flush();
    line.push(word);
    if (/[.!?;:]$/.test(word)) flush();
  }
  flush();
  return cues;
  function flush() {
    if (!line.length) return;
    const end = start + line.length * secondsPerWord;
    cues.push({ text: line.join(" "), start, end }); start = end; line = [];
  }
}

export function captionAt(cues: CaptionCue[], seconds: number): string {
  return cues.find(cue => seconds >= cue.start && seconds < cue.end)?.text || "";
}
