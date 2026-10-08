"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { Persona, Repository } from "@/domain/schemas";

const SPECTRUM = [
  { key: "stability", left: "Experimental", right: "Stable" },
  { key: "strictness", left: "Flexible", right: "Strict" },
  { key: "playfulness", left: "Formal", right: "Playful" },
] as const;
const VOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir", "Leda", "Orus", "Zephyr"] as const;
const DEFAULT_DNA = { stability: 50, strictness: 50, playfulness: 50 };

type Section = "identity" | "quote" | "bio" | "personality" | "spectrum" | "goals" | "frustrations" | "audience" | "beliefs" | "voice";
type Draft = Record<string, string | number>;
export type { PersonaPatch } from "@/server/persona-edit";
import type { PersonaPatch } from "@/server/persona-edit";

const lines = (text: string | number, max: number) => String(text).split("\n").map(l => l.trim()).filter(Boolean).slice(0, max);

function draftFor(section: Section, p: Persona): Draft {
  switch (section) {
    case "identity": return { name: p.name, archetype: p.archetype ?? "" };
    case "quote": return { tagline: p.tagline };
    case "bio": return { backstory: p.backstory };
    case "personality": return { traits: p.traits.join("\n") };
    case "spectrum": return { ...DEFAULT_DNA, ...p.dna };
    case "goals": return { goals: (p.goals ?? []).join("\n") };
    case "frustrations": return { frustrations: (p.frustrations ?? []).join("\n") };
    case "audience": return { audience: p.audience ?? "" };
    case "beliefs": return { convictions: p.convictions.join("\n") };
    case "voice": return { tone: p.voice.tone, speakingStyle: p.speakingStyle, voiceName: p.voice.name ?? "" };
  }
}

function patchFor(section: Section, d: Draft): PersonaPatch {
  switch (section) {
    case "identity": return { name: String(d.name).trim(), archetype: String(d.archetype).trim() };
    case "quote": return { tagline: String(d.tagline).trim() };
    case "bio": return { backstory: String(d.backstory).trim() };
    case "personality": return { traits: lines(d.traits, 6) };
    case "spectrum": return { dna: { stability: Number(d.stability), strictness: Number(d.strictness), playfulness: Number(d.playfulness) } };
    case "goals": return { goals: lines(d.goals, 4) };
    case "frustrations": return { frustrations: lines(d.frustrations, 4) };
    case "audience": return { audience: String(d.audience).trim() };
    case "beliefs": return { convictions: lines(d.convictions, 6) };
    case "voice": return { speakingStyle: String(d.speakingStyle).trim(), voice: { tone: String(d.tone).trim(), ...(d.voiceName ? { name: d.voiceName as Persona["voice"]["name"] } : {}) } };
  }
}

export function PersonaCard({ persona, repository, photo, disabled, onDownload, onSave }: {
  persona: Persona; repository: Repository; photo: string; disabled: boolean;
  onDownload: () => void; onSave: (patch: PersonaPatch) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<Section>();
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  const open = (section: Section) => { setEditing(section); setDraft(draftFor(section, persona)); };
  const cancel = () => setEditing(undefined);
  async function save() {
    if (!editing) return;
    setSaving(true);
    const saved = await onSave(patchFor(editing, draft));
    setSaving(false);
    if (saved) setEditing(undefined);
  }
  const keys = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); }
  };
  const set = (key: string) => (e: { target: { value: string } }) => setDraft(d => ({ ...d, [key]: e.target.value }));

  const editButton = (section: Section, label: string) =>
    <button type="button" className="section-edit" onClick={() => open(section)} disabled={disabled || saving || (!!editing && editing !== section)} aria-label={`Edit ${label}`}>Edit</button>;

  // Wraps a section: title row with an Edit control, then either the content or its editor.
  const section = (id: Section, title: string, view: ReactNode, editor: ReactNode, hint?: string) =>
    <section className={`persona-section ${editing === id ? "is-editing" : ""}`}>
      <div className="section-head"><h3>{title}</h3>{editing !== id && editButton(id, title)}</div>
      {editing === id ? <form className="section-editor" onKeyDown={keys} onSubmit={e => { e.preventDefault(); void save(); }}>
        {editor}
        {hint && <p className="editor-hint">{hint}</p>}
        <div className="editor-actions">
          <button type="button" className="secondary" onClick={cancel} disabled={saving}>Cancel</button>
          <button disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form> : view}
    </section>;

  const area = (key: string, label: string, rows = 3, maxLength?: number) =>
    <label className="editor-field"><span>{label}</span><textarea id={`persona-${key}`} rows={rows} value={String(draft[key] ?? "")} onChange={set(key)} maxLength={maxLength} autoFocus /></label>;
  const field = (key: string, label: string, maxLength: number, autoFocus = false) =>
    <label className="editor-field"><span>{label}</span><input id={`persona-${key}`} value={String(draft[key] ?? "")} onChange={set(key)} maxLength={maxLength} autoFocus={autoFocus} /></label>;
  const empty = (text: string) => <p className="section-empty">{text}</p>;

  return <article className="card persona">
    <div className="card-label"><span className="label-title">Persona · click Edit on any section</span><button className="text-button" onClick={onDownload}>↓ PERSONA.md</button></div>

    <div className="persona-layout">
      <div className="persona-profile">
    {editing === "identity"
      ? <section className="persona-section is-editing"><form className="section-editor" onKeyDown={keys} onSubmit={e => { e.preventDefault(); void save(); }}>
          {field("name", "Name", 80, true)}
          {field("archetype", "Archetype", 80)}
          <div className="editor-actions"><button type="button" className="secondary" onClick={cancel} disabled={saving}>Cancel</button><button disabled={saving}>{saving ? "Saving…" : "Save"}</button></div>
        </form></section>
      : <header className="persona-head">
          <img className="persona-photo" src={photo} alt="" />
          <div><h2>{persona.name}</h2><p className="persona-role">{persona.archetype || "Repository persona"}</p></div>
          {editButton("identity", "name and archetype")}
        </header>}

    {editing === "quote"
      ? section("quote", "Quote", null, field("tagline", "Tagline", 200, true))
      : <div className="persona-quote-row"><blockquote className="persona-quote">“{persona.tagline}”</blockquote>{editButton("quote", "quote")}</div>}

    <dl className="persona-facts">
      <div><dt>Lives at</dt><dd>{repository.owner}/{repository.name}</dd></div>
      <div><dt>Speaks</dt><dd>{persona.voice.language}</dd></div>
      <div><dt>Voice</dt><dd>{persona.voice.name || "Stock"}</dd></div>
    </dl>


    {section("personality", "Personality",
      <div className="chips">{persona.traits.map(t => <span key={t}>{t}</span>)}</div>,
      area("traits", "Traits", 4), "One trait per line, up to 6.")}

    {section("spectrum", "Repo DNA spectrum",
      persona.dna
        ? <div className="spectrum">{SPECTRUM.map(({ key, left, right }) =>
            <div key={key} className="spectrum-row">
              <span>{left}</span>
              <div className="spectrum-track" role="meter" aria-label={`${left} to ${right}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={persona.dna![key]}><i style={{ left: `${persona.dna![key]}%` }} /></div>
              <span>{right}</span>
            </div>)}
          </div>
        : empty("Not set yet. Place this repository between experimental and stable, flexible and strict, formal and playful."),
      <div className="spectrum">{SPECTRUM.map(({ key, left, right }) =>
        <label key={key} className="spectrum-row spectrum-edit">
          <span>{left}</span>
          <input id={`persona-dna-${key}`} type="range" min={0} max={100} step={5} value={Number(draft[key] ?? 50)} onChange={set(key)} aria-label={`${left} to ${right}`} />
          <span>{right}</span>
        </label>)}
      </div>)}

      </div>
      <div className="persona-details">
    {section("bio", "Bio", <p>{persona.backstory}</p>, area("backstory", "Bio", 5, 1200))}

    <div className="persona-split">
      {section("goals", "Goals",
        persona.goals?.length ? <ul>{persona.goals.map(g => <li key={g}>{g}</li>)}</ul> : empty("What does it want to help people do?"),
        area("goals", "Goals", 4), "One goal per line, up to 4.")}
      {section("frustrations", "Frustrations",
        persona.frustrations?.length ? <ul>{persona.frustrations.map(f => <li key={f}>{f}</li>)}</ul> : empty("What does it push back on?"),
        area("frustrations", "Frustrations", 4), "One per line, up to 4.")}
    </div>

    {section("audience", "Who I'm for", persona.audience ? <p>{persona.audience}</p> : empty("Who is this repository for?"), area("audience", "Who I'm for", 3, 300))}

    {section("beliefs", "What I believe",
      persona.convictions.length ? <ul>{persona.convictions.map(c => <li key={c}>{c}</li>)}</ul> : empty("What does it believe in?"),
      area("convictions", "Beliefs", 4), "One belief per line, up to 6.")}

    {section("voice", "How I sound",
      <p>{persona.voice.tone}. {persona.speakingStyle}</p>,
      <>
        {field("tone", "Tone", 200, true)}
        <label className="editor-field"><span>Speaking style</span><textarea id="persona-speakingStyle" rows={3} value={String(draft.speakingStyle ?? "")} onChange={set("speakingStyle")} maxLength={500} /></label>
        <label className="editor-field"><span>Read-aloud voice</span>
          <select id="persona-voiceName" value={String(draft.voiceName ?? "")} onChange={set("voiceName")}>
            {!draft.voiceName && <option value="">Stock</option>}
            {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </>)}

      </div>
    </div>

    <small>Fictional personality · repository facts come from the README</small>
  </article>;
}
