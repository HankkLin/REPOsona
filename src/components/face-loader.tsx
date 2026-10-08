"use client";

import { useEffect, useState } from "react";
import { SketchAvatar } from "./sketch-avatar";

const STEPS = ["Sketching the silhouette", "Pulling colors from the README", "Adding the small details", "Almost there"];

// Full-screen wait while the face generates: the sketch keeps rebuilding itself, like a construction loop.
export function FaceLoader({ name, refining }: { name: string; refining: boolean }) {
  const [build, setBuild] = useState(0);
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rebuild = window.setInterval(() => setBuild(b => b + 1), 2600);
    const caption = window.setInterval(() => setLine(l => Math.min(l + 1, STEPS.length - 1)), 1100);
    return () => { clearInterval(rebuild); clearInterval(caption); };
  }, []);
  return <section className="face-loader" role="status" aria-live="polite">
    <SketchAvatar key={`build-${build}`} className="loader-avatar" />
    <p className="eyebrow">{refining ? "Refining the face" : "Giving it a face"}</p>
    <h1>{name}</h1>
    <p className="loader-line" key={`line-${line}`}>{STEPS[line]}…</p>
    <div className="loader-track" aria-hidden><i /></div>
  </section>;
}
