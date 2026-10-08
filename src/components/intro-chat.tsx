"use client";

import { useEffect, useRef, useState } from "react";
import { SketchAvatar } from "./sketch-avatar";

const LINES = [
  "Hi! I'm your repository.",
  "I read my own README so you don't have to.",
  "Ask me how to get started, or why I'm built this way.",
  "If my README doesn't say, I'll tell you. No guessing.",
];
const BUILD_MS = 1900;

type Phase = "build" | "typing" | "answer" | "leave";

export function IntroChat() {
  const turbulence = useRef<SVGFETurbulenceElement>(null);
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<Phase>("build");
  const [words, setWords] = useState(0);
  const [still, setStill] = useState(false);

  const answerWords = LINES[turn].split(" ");
  const speaking = phase === "answer" && words < answerWords.length;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true); setPhase("answer"); setWords(LINES[0].split(" ").length);
    }
  }, []);

  // Speech loop: avatar types, the line reveals word by word, holds, then clears for the next one.
  useEffect(() => {
    if (still) return;
    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    if (phase === "build") after(BUILD_MS, () => setPhase("typing"));
    if (phase === "typing") after(900, () => { setWords(0); setPhase("answer"); });
    if (phase === "answer") {
      if (words < answerWords.length) after(words === 0 ? 60 : 85, () => setWords(w => w + 1));
      else after(2400, () => setPhase("leave"));
    }
    if (phase === "leave") after(180, () => { setTurn(t => (t + 1) % LINES.length); setWords(0); setPhase("typing"); });
    return () => timers.forEach(clearTimeout);
  }, [phase, words, still, answerWords.length]);

  // Line boil: re-seed the rough filter a few times a second while the avatar talks, like hand-drawn frames.
  useEffect(() => {
    if (!speaking) return;
    let seed = 1;
    const id = window.setInterval(() => turbulence.current?.setAttribute("seed", String((seed = (seed % 4) + 1))), 120);
    return () => clearInterval(id);
  }, [speaking]);

  return <div className={`intro ${still ? "still" : ""}`} role="img" aria-label="A repository avatar introducing itself">
    <div className="intro-speech" aria-hidden>
      {phase !== "build" && <p key={turn} className={`intro-bubble ${phase === "leave" ? "leaving" : ""}`}>
        {phase === "typing"
          ? <span className="intro-dots"><i /><i /><i /></span>
          : answerWords.map((word, i) => <span key={i} className={i < words ? "on" : ""}>{word} </span>)}
      </p>}
    </div>
    <SketchAvatar talking={speaking} turbulence={turbulence} />
  </div>;
}
