"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function CallIcon({ name }: { name: "camera" | "screen" | "captions" | "speaker" | "chat" | "fullscreen" | "leave" | "mic" | "stop" }) {
  const paths = {
    camera: <><rect x="3" y="6" width="12" height="12" rx="3" /><path d="m15 10 6-3v10l-6-3" /></>,
    screen: <><rect x="3" y="3" width="18" height="14" rx="2" /><path d="M8 21h8M12 17v4m-4-10 4-4 4 4M12 7v7" /></>,
    captions: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M10 9H6v6h4m8-6h-4v6h4" /></>,
    speaker: <><path d="m3 9 4 0 5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    chat: <path d="M21 15a3 3 0 0 1-3 3H9l-6 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3zM7 8h10M7 12h6" />,
    fullscreen: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    leave: <path d="M3 14v-4c5-4 13-4 18 0v4h-5v-4M8 10v4H3" />,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></>,
    stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  };
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Preview({ stream, label, mirror = false }: { stream: MediaStream; label: string; mirror?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (video.current) video.current.srcObject = stream; }, [stream]);
  return <div className={`local-preview ${mirror ? "mirror" : ""}`}><video ref={video} autoPlay muted playsInline /><span>{label}</span></div>;
}

export function MeetingTools({ children, disabled, onError }: { children: ReactNode; disabled: boolean; onError: (message: string) => void }) {
  const [camera, setCamera] = useState<MediaStream>();
  const [screen, setScreen] = useState<MediaStream>();
  const [requesting, setRequesting] = useState(false);
  const streams = useRef<{ camera?: MediaStream; screen?: MediaStream }>({});
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; Object.values(streams.current).forEach(stream => stream?.getTracks().forEach(track => track.stop())); };
  }, []);
  async function toggle(kind: "camera" | "screen") {
    const active = streams.current[kind];
    if (active) {
      active.getTracks().forEach(track => track.stop()); streams.current[kind] = undefined;
      (kind === "camera" ? setCamera : setScreen)(undefined); return;
    }
    setRequesting(true);
    try {
      if (!navigator.mediaDevices) throw new Error("Media controls require a supported browser on HTTPS or localhost.");
      if (kind === "screen" && !navigator.mediaDevices.getDisplayMedia) throw new Error("Screen sharing is unavailable in this browser.");
      const stream = kind === "camera"
        ? await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streams.current[kind] = stream;
      (kind === "camera" ? setCamera : setScreen)(stream);
      stream.getVideoTracks()[0].onended = () => {
        stream.getTracks().forEach(track => track.stop());
        if (streams.current[kind] === stream) { streams.current[kind] = undefined; if (mounted.current) (kind === "camera" ? setCamera : setScreen)(undefined); }
      };
    } catch (error) {
      if (mounted.current) onError(error instanceof Error && error.name === "NotAllowedError" ? "Permission was declined. You can continue talking without camera or screen sharing." : error instanceof Error ? error.message : "Could not access media.");
    } finally { if (mounted.current) setRequesting(false); }
  }
  return <>
    <div className="meeting-local-tiles">{screen && <Preview stream={screen} label="Your shared screen · local preview" />}{camera && <Preview stream={camera} label="You · camera preview" mirror />}</div>
    <div className="meeting-toolbar" role="group" aria-label="Meeting controls">
      {children}
      <button type="button" className="meeting-control" aria-pressed={!!camera} disabled={disabled || requesting} onClick={() => void toggle("camera")}><CallIcon name="camera" /><span>{camera ? "Camera on" : "Camera off"}</span></button>
      <button type="button" className="meeting-control" aria-pressed={!!screen} disabled={disabled || requesting} onClick={() => void toggle("screen")}><CallIcon name="screen" /><span>{screen ? "Stop sharing" : "Share screen"}</span></button>
    </div>
    {(camera || screen) && <p className="media-note">Camera and screen previews stay on your device. The avatar answers from the repository README.</p>}
  </>;
}
