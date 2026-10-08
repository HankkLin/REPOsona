import type { Persona, Repository } from "@/domain/schemas";

const SPECTRUM = [
  { key: "stability", left: "Experimental", right: "Stable" },
  { key: "strictness", left: "Flexible", right: "Strict" },
  { key: "playfulness", left: "Formal", right: "Playful" },
] as const;

export function PersonaCard({ persona, repository, photo, onDownload }: { persona: Persona; repository: Repository; photo: string; onDownload: () => void }) {
  return <article className="card persona">
    <div className="card-label"><span className="label-title"><span className="step">01</span>Repo DNA</span><button className="text-button" onClick={onDownload}>↓ PERSONA.md</button></div>

    <header className="persona-head">
      <img className="persona-photo" src={photo} alt="" />
      <div>
        <h2>{persona.name}</h2>
        <p className="persona-role">{persona.archetype || "Repository persona"}</p>
      </div>
    </header>
    <blockquote className="persona-quote">“{persona.tagline}”</blockquote>

    <dl className="persona-facts">
      <div><dt>Lives at</dt><dd>{repository.owner}/{repository.name}</dd></div>
      <div><dt>Speaks</dt><dd>{persona.voice.language}</dd></div>
      <div><dt>Voice</dt><dd>{persona.voice.name || "Stock"}</dd></div>
    </dl>

    <h3>Bio</h3>
    <p>{persona.backstory}</p>

    <h3>Personality</h3>
    <div className="chips">{persona.traits.map(t => <span key={t}>{t}</span>)}</div>

    {persona.dna && <>
      <h3>Repo DNA spectrum</h3>
      <div className="spectrum">{SPECTRUM.map(({ key, left, right }) =>
        <div key={key} className="spectrum-row">
          <span>{left}</span>
          <div className="spectrum-track" role="meter" aria-label={`${left} to ${right}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={persona.dna![key]}><i style={{ left: `${persona.dna![key]}%` }} /></div>
          <span>{right}</span>
        </div>)}
      </div>
    </>}

    {(persona.goals?.length || persona.frustrations?.length) ? <div className="persona-split">
      {persona.goals?.length ? <div className="goals"><h3>Goals</h3><ul>{persona.goals.map(g => <li key={g}>{g}</li>)}</ul></div> : null}
      {persona.frustrations?.length ? <div className="frustrations"><h3>Frustrations</h3><ul>{persona.frustrations.map(f => <li key={f}>{f}</li>)}</ul></div> : null}
    </div> : null}

    {persona.audience && <><h3>Who I'm for</h3><p>{persona.audience}</p></>}

    <h3>What I believe</h3>
    <ul>{persona.convictions.map(c => <li key={c}>{c}</li>)}</ul>

    <h3>How I sound</h3>
    <p>{persona.voice.tone}. {persona.speakingStyle}</p>

    <small>Fictional personality · repository facts come from the README</small>
  </article>;
}
