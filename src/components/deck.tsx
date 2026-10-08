"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SketchAvatar } from "./sketch-avatar";

const TEAM = ["Kathy", "Aung", "Hank", "Jennifer"];

// A static shot of a GitHub README: the wall of text every repository starts with.
function ReadmeShot() {
  return <figure className="gh-shot" aria-label="A README file as it appears on GitHub">
    <div className="gh-bar"><span /><span /><span /><p>github.com/you/something-great</p></div>
    <div className="gh-file">
      <div className="gh-file-head"><b>README.md</b><span>Preview</span><span>Code</span><span>Blame</span></div>
      <div className="gh-body">
        <h1>something-great</h1>
        <p>A fast, flexible toolkit for building composable services. Supports plugins, streaming, caching, and configurable adapters for most runtimes.</p>
        <h2>Installation</h2>
        <pre>npm install something-great</pre>
        <h2>Configuration</h2>
        <p>Create a <code>config.json</code> in the project root. All options are optional; defaults are documented in <code>docs/options.md</code>.</p>
        <table><thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead><tbody><tr><td><code>cache</code></td><td>boolean</td><td><code>true</code></td></tr><tr><td><code>adapters</code></td><td>string[]</td><td><code>[]</code></td></tr><tr><td><code>timeout</code></td><td>number</td><td><code>3000</code></td></tr></tbody></table>
        <h2>Contributing</h2>
        <p>Please open an issue before submitting a pull request. See <code>CONTRIBUTING.md</code>.</p>
      </div>
    </div>
  </figure>;
}

const SLIDES: { label: string; body: ReactNode }[] = [
  { label: "REPOsona", body: <div className="slide-title">
    <SketchAvatar className="deck-avatar" />
    <h1>REPO<span>sona</span><sup>✦</sup></h1>
    <p>Meet the personality behind your repository.</p>
  </div> },
  { label: "The problem", body: <div className="slide-split">
    <div><p className="slide-kicker">The problem</p><h2>Every repository starts like this.</h2><p className="slide-lede">Long, flat, and easy to skip.</p></div>
    <ReadmeShot />
  </div> },
  { label: "The idea", body: <div className="slide-center">
    <p className="slide-kicker">The idea</p>
    <h2>A README becomes a persona, a face, and a conversation.</h2>
  </div> },
  { label: "How it works", body: <div className="slide-center">
    <p className="slide-kicker">How it works</p>
    <ol className="deck-steps">
      <li><span>1</span><b>Meet</b><p>Paste a GitHub link. We read the README and discover its personality.</p></li>
      <li><span>2</span><b>Refine</b><p>Give it a face, then edit any part of the persona.</p></li>
      <li><span>3</span><b>Talk</b><p>Ask questions on a video call. Answers cite the README.</p></li>
    </ol>
  </div> },
  { label: "Under the hood", body: <div className="slide-center">
    <p className="slide-kicker">Under the hood</p>
    <h2>Grounded, then animated.</h2>
    <div className="chips deck-chips"><span>Next.js</span><span>Gemini</span><span>Nano Banana</span><span>Gemini embeddings</span><span>Reactor LTX</span></div>
  </div> },
  { label: "Team", body: <div className="slide-center">
    <p className="slide-kicker">The team</p>
    <h2>Thank you.</h2>
    <ul className="deck-team">{TEAM.map(name => <li key={name}><b>{name}</b></li>)}</ul>
  </div> },
];

export function Deck() {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const go = useCallback((delta: number) => setIndex(i => Math.min(SLIDES.length - 1, Math.max(0, i + delta))), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(SLIDES.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);
  return <main className="deck"
    onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
    onTouchEnd={e => { if (touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touchX.current = null; }}>
    <section className="deck-slide" key={index} aria-roledescription="slide" aria-label={`${index + 1} of ${SLIDES.length}: ${SLIDES[index].label}`}>{SLIDES[index].body}</section>
    <nav className="deck-nav" aria-label="Slides">
      <button type="button" className="secondary" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous slide">←</button>
      <div className="deck-dots">{SLIDES.map((s, i) => <button key={s.label} type="button" className={i === index ? "active" : ""} aria-label={`Go to slide ${i + 1}: ${s.label}`} aria-current={i === index ? "step" : undefined} onClick={() => setIndex(i)} />)}</div>
      <button type="button" className="secondary" onClick={() => go(1)} disabled={index === SLIDES.length - 1} aria-label="Next slide">→</button>
    </nav>
  </main>;
}
