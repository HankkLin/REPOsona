"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ltx2Model } from "@reactor-models/ltx2/core";
import type { Persona } from "@/domain/schemas";

export type ReactorHandle = { speak: (script: string) => Promise<void> };
export const ReactorAvatar = forwardRef<ReactorHandle, { jwt: string; expiresAt: number; image: string; persona: Persona; onClose: () => void }>(function ReactorAvatar({ jwt, expiresAt, image, persona, onClose }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const model = useRef<Ltx2Model | null>(null);
  const running = useRef(false);
  const [status, setStatus] = useState("Connecting to LTX…");
  const [ready, setReady] = useState(false);
  useImperativeHandle(ref, () => ({ speak: async script => {
    const current = model.current;
    if (!current || !ready) throw new Error("Avatar is still connecting. Your text answer is available below.");
    if (running.current) await current.stop();
    await current.setScript({ script });
    await current.start();
    running.current = true;
    setStatus("Preparing voice and video…");
    await video.current?.play().catch(() => setStatus("Press play on the video to hear the avatar."));
  } }), [ready]);
  useEffect(() => {
    let cancelled = false;
    let client: Ltx2Model | undefined;
    const stream = new MediaStream();
    const timer = setTimeout(onClose, Math.max(0, Math.min(expiresAt * 1000 - Date.now() - 5000, 600000)));
    async function connect() {
      try {
        const { Ltx2Model } = await import("@reactor-models/ltx2/core");
        if (cancelled) return;
        client = new Ltx2Model(); model.current = client;
        const attach = (track: MediaStreamTrack) => { if (cancelled) return; stream.addTrack(track); if (video.current) video.current.srcObject = stream; };
        client.onMainVideo(attach); client.onMainAudio(attach);
        client.onCommandError(() => { if (!cancelled) setStatus("A model command was rejected. Stop and reconnect if needed."); });
        client.onGenerationFailed(() => { running.current = false; if (!cancelled) setStatus("Generation failed. Your text answer is still available."); });
        client.onGenerationStarted(() => { if (!cancelled) setStatus("Generating your avatar’s response…"); });
        client.onGenerationComplete(() => { running.current = false; if (!cancelled) setStatus("Ready for your next question."); });
        await client.connect(jwt);
        if (cancelled) return;
        const match = image.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
        if (!match) throw new Error("Avatar image is invalid.");
        const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
        const file = await client.uploadFile(new Blob([bytes], { type: match[1] }));
        if (cancelled) return;
        await client.setAvatarImage({ avatar_image: file });
        await client.setPrompt({ prompt: `A front-facing Octocat mascot speaking naturally, preserving the reference identity. Voice: ${persona.voice.tone}. Language: ${persona.voice.language}. Delivery: ${persona.speakingStyle}.`.slice(0, 800) });
        await client.setWpm({ wpm: Math.round(Math.min(220, Math.max(80, persona.voice.rate * 140))) });
        await client.resumeTrack("main_video"); await client.resumeTrack("main_audio");
        if (!cancelled) { setReady(true); setStatus("Connected. Ask a question below to hear your avatar."); }
      } catch (error) {
        if (!cancelled) { setReady(false); setStatus(error instanceof Error ? error.message : "Could not connect to Reactor."); }
        await client?.disconnect().catch(() => undefined);
        if (model.current === client) model.current = null;
      }
    }
    void connect();
    return () => { cancelled = true; clearTimeout(timer); model.current = null; void client?.disconnect().catch(() => undefined); stream.getTracks().forEach(track => track.stop()); };
  }, [jwt, expiresAt, image, persona, onClose]);
  return <div className="reactor-player"><video ref={video} controls autoPlay playsInline aria-label="Live repository avatar" /><div><span role="status">{status}</span><button className="secondary" onClick={onClose}>Disconnect avatar</button></div><small>LTX speaks the cited Gemini answer. Sessions close after 10 minutes; reconnect to continue.</small></div>;
});
