"use client";
import { useEffect, useState } from "react";

export function VoiceDirection({ direction = "", wpm, disabled, demo, onSave, onPreview, previewDisabled = false }: { direction?: string; wpm?: number; disabled: boolean; demo: boolean; onSave: (direction: string) => Promise<boolean>; onPreview?: () => void; previewDisabled?: boolean }) {
  const [draft, setDraft] = useState(direction);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(direction); }, [direction]);
  return <section className="voice-direction">
    <form onSubmit={async event => { event.preventDefault(); setSaving(true); try { setSaved(await onSave(draft.trim())); } finally { setSaving(false); } }}>
      <label htmlFor="voice-direction">Voice direction</label>
      <p>Describe how you want your avatar to sound.</p>
      <div><textarea id="voice-direction" value={draft} onChange={event => { setDraft(event.target.value); setSaved(false); }} maxLength={400} rows={2} disabled={disabled || saving} placeholder="A low, chesty baritone with gravelly grain, long vowels and slow, deliberate pauses." /><button disabled={disabled || saving || (draft.trim() === direction.trim() && (!draft.trim() || wpm !== undefined))}>{saving ? "Casting voice…" : "Save voice"}</button>{onPreview && <button type="button" disabled={disabled || saving || previewDisabled || draft.trim() !== direction.trim()} onClick={onPreview}>Preview voice</button>}</div>
      <small role="status">{saved ? "Saved. Preview the voice or ask a question to hear the change." : demo ? "Saved for live mode. Demo speech uses browser voices." : "Describe pitch, texture, accent, and rhythm; save, then preview to hear the change."}{wpm !== undefined && !demo && ` · ${wpm} WPM`}</small>
    </form>
  </section>;
}
