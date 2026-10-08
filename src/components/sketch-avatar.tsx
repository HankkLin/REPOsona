"use client";

import { useId, type RefObject } from "react";

// The hand-drawn mascot: lines draw in, details pop, and a rough filter gives it a sketched edge.
// Remount it (change its key) to replay the build.
export function SketchAvatar({ talking = false, className = "", turbulence }: { talking?: boolean; className?: string; turbulence?: RefObject<SVGFETurbulenceElement | null> }) {
  const filterId = useId().replace(/:/g, "");
  return <svg className={`intro-avatar ${talking ? "talking" : ""} ${className}`} viewBox="0 0 200 220" aria-hidden>
    <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence ref={turbulence} type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={1} result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={2.6} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <g filter={`url(#${filterId})`} strokeLinecap="round" strokeLinejoin="round">
      <path className="draw" style={{ "--d": "1.35s" } as React.CSSProperties} pathLength={1} d="M18 206 q18 -5 36 0 t36 0 t36 0 t36 0 t20 0" fill="none" />
      <g className="bob">
        <path className="draw" style={{ "--d": ".55s" } as React.CSSProperties} pathLength={1} d="M62 206 C58 172 68 146 100 144 C132 146 142 172 138 206 Z" />
        <path className="draw hood" style={{ "--d": "0s" } as React.CSSProperties} pathLength={1} d="M42 120 C36 74 60 42 102 36 C128 32 148 18 164 8 C160 32 164 62 160 94 C162 106 160 116 158 122 C152 148 128 158 100 158 C70 158 46 148 42 120 Z" />
        <ellipse className="draw face" style={{ "--d": ".3s" } as React.CSSProperties} pathLength={1} cx="100" cy="114" rx="40" ry="34" />
        <circle className="pop sun" style={{ "--d": "1.05s" } as React.CSSProperties} cx="164" cy="9" r="9" />
        <g className="eyes">
          <ellipse className="pop ink" style={{ "--d": ".95s" } as React.CSSProperties} cx="86" cy="113" rx="3.4" ry="4.2" />
          <ellipse className="pop ink" style={{ "--d": "1s" } as React.CSSProperties} cx="114" cy="113" rx="3.4" ry="4.2" />
        </g>
        <ellipse className="pop blush" style={{ "--d": "1.1s" } as React.CSSProperties} cx="75" cy="125" rx="7" ry="4" />
        <ellipse className="pop blush" style={{ "--d": "1.15s" } as React.CSSProperties} cx="125" cy="125" rx="7" ry="4" />
        <path className="mouth-closed pop line" style={{ "--d": "1.1s" } as React.CSSProperties} d="M95 127 q5 4 10 0" />
        <ellipse className="mouth-open" cx="100" cy="128" rx="4" ry="3.4" />
        <g className="pop book" style={{ "--d": "1.2s" } as React.CSSProperties}>
          <rect x="76" y="160" width="48" height="34" rx="4" transform="rotate(-6 100 177)" />
          <path className="line" d="M84 172 l18 -2 M85 180 l13 -1.4" transform="rotate(-6 100 177)" />
        </g>
        <ellipse className="pop paw" style={{ "--d": "1.25s" } as React.CSSProperties} cx="76" cy="180" rx="9" ry="8" />
        <ellipse className="pop paw" style={{ "--d": "1.3s" } as React.CSSProperties} cx="124" cy="176" rx="9" ry="8" />
      </g>
      <path className="pop spark tomato" style={{ "--d": "1.45s" } as React.CSSProperties} d="M26 52 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 Z" />
      <path className="pop spark sky" style={{ "--d": "1.55s" } as React.CSSProperties} d="M182 132 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 Z" />
    </g>
  </svg>;
}
