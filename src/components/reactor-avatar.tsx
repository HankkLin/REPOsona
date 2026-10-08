"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ltx2Model } from "@reactor-models/ltx2/core";
import type { Persona } from "@/domain/schemas";

export type ReactorState = "connecting" | "ready" | "speaking" | "error";
export type ReactorHandle = { speak: (script: string) => Promise<void>; stop: () => Promise<void> };
export const ReactorAvatar = forwardRef<ReactorHandle, { jwt: string; expiresAt: number; image: string; persona: Persona; onClose: () => void; onState: (state: ReactorState) => void }>(function ReactorAvatar({ jwt, expiresAt, image, persona, onClose, onState }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const model = useRef<Ltx2Model | null>(null);
  const running = useRef(false);
  const [status, setStatus] = useState("Joining your video meeting…");
  const [ready, setReady] = useState(false);
  useImperativeHandle(ref, () => ({ speak: async script => {
    const current = model.current;
    if (!current || !ready) throw new Error("Avatar is still connecting. Your text answer is available below.");
    if (running.current) { await current.stop(); running.current = false; }
    await current.setScript({ script });
    await current.start();
    running.current = true;
    onState("speaking");
    setStatus("Preparing voice and video…");
    await video.current?.play().catch(() => setStatus("Press play on the video to hear the avatar."));
  }, stop: async () => {
    video.current?.pause();
    if (running.current && model.current) { await model.current.stop(); running.current = false; onState("ready"); setStatus("Response stopped. Ready for your next question."); }
  } }), [ready, onState]);
  useEffect(() => {
    let cancelled = false;
    let client: Ltx2Model | undefined;
    const stream = new MediaStream();
    onState("connecting");
    const timer = setTimeout(onClose, Math.max(0, Math.min(expiresAt * 1000 - Date.now() - 5000, 600000)));
    async function connect() {
      try {
        const { Ltx2Model } = await import("@reactor-models/ltx2/core");
        if (cancelled) return;
        client = new Ltx2Model(); model.current = client;
        const attach = (track: MediaStreamTrack) => { if (cancelled) return; stream.addTrack(track); if (video.current) { video.current.srcObject = stream; void video.current.play().catch(() => setStatus("Press play on the video to hear the avatar.")); } };
        client.onMainVideo(attach); client.onMainAudio(attach);
        client.onCommandError(() => { if (!cancelled) setStatus("A model command was rejected. Stop and reconnect if needed."); });
        client.onGenerationFailed(() => { running.current = false; if (!cancelled) { onState("ready"); setStatus("Video generation failed. Your text answer is still available; try another question."); } });
        client.onGenerationStarted(() => { if (!cancelled) { running.current = true; onState("speaking"); setStatus("Your avatar is preparing its video answer…"); } });
        client.onGenerationStopped(() => { running.current = false; if (!cancelled) { onState("ready"); setStatus("Ready for your next question."); } });
        client.onGenerationComplete(() => { running.current = false; if (!cancelled) { onState("ready"); setStatus("Ready for your next question."); } });
        await client.connect(jwt);
        if (cancelled) return;
        const match = image.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
        if (!match) throw new Error("Avatar image is invalid.");
        const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
        const file = await client.uploadFile(new Blob([bytes], { type: match[1] }));
        if (cancelled) return;
        await client.setAvatarImage({ avatar_image: file });
        await client.setPrompt({ prompt: `The repository mascot in the reference portrait is in a video meeting, looking into the camera and speaking naturally. Preserve its species, non-human anatomy, stylized appearance, face and background; do not transform it into a human presenter. Subtle gestures and expressive mouth movement. Voice: ${persona.voice.tone}. Language: ${persona.voice.language}. Delivery: ${persona.speakingStyle}.`.slice(0, 800) });
        await client.setWpm({ wpm: Math.round(Math.min(220, Math.max(80, persona.voice.rate * 140))) });
        await client.resumeTrack("main_video"); await client.resumeTrack("main_audio");
        if (!cancelled) { setReady(true); onState("ready"); setStatus("Connected. Type a question or use your microphone."); }
      } catch (error) {
        if (!cancelled) { setReady(false); onState("error"); setStatus(error instanceof Error && /Session limit|403/.test(error.message) ? "This meeting session is no longer available. Rejoin to start a new session." : error instanceof Error ? `Could not join: ${error.message}. Rejoin to retry.` : "Could not connect to Reactor. Rejoin to retry."); }
        await client?.disconnect().catch(() => undefined);
        if (model.current === client) model.current = null;
      }
    }
    void connect();
    return () => { cancelled = true; clearTimeout(timer); model.current = null; void client?.disconnect().catch(() => undefined); stream.getTracks().forEach(track => track.stop()); };
  }, [jwt, expiresAt, image, persona, onClose, onState]);
  return <div className="reactor-player"><div className="meeting-video"><video ref={video} poster={image} controls autoPlay playsInline aria-label="Live repository avatar" onPlaying={() => setStatus("Your avatar is answering. You can stop it to ask another question.")} /><span className="participant-name">{persona.name}</span></div><div><span role="status">{status}</span><button className="leave-call" onClick={onClose}>Leave meeting</button></div><small>Video and voice powered by Reactor · Sessions last up to 10 minutes.</small></div>;
});
