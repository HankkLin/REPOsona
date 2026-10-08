"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ltx2Model } from "@reactor-models/ltx2/core";
import type { Persona } from "@/domain/schemas";
import { meetingStep } from "./meeting-step";
import { startMeetingWelcome } from "./meeting-welcome";
import { captionAt, captionCues, type CaptionCue } from "./meeting-captions";
import { AvatarVoiceSettings, avatarWpm } from "./meeting-voice";

export type ReactorState = "connecting" | "ready" | "speaking" | "error";
export type ReactorHandle = { speak: (script: string) => Promise<void>; stop: () => Promise<void> };
export const ReactorAvatar = forwardRef<ReactorHandle, { jwt: string; expiresAt: number; image: string; persona: Persona; muted?: boolean; onClose: () => void; onState: (state: ReactorState) => void; onCaption: (caption: string) => void }>(function ReactorAvatar({ jwt, expiresAt, image, persona, muted = false, onClose, onState, onCaption }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const model = useRef<Ltx2Model | null>(null);
  const running = useRef(false);
  const voiceSettings = useRef(new AvatarVoiceSettings());
  const personaRef = useRef(persona);
  personaRef.current = persona;
  const cues = useRef<CaptionCue[]>([]);
  const playbackStart = useRef<number | undefined>(undefined);
  const prepareCaptions = (script: string) => {
    const width = video.current?.clientWidth || 640;
    const lineLength = Math.max(20, Math.min(52, Math.floor((width - 60) / 8)));
    cues.current = captionCues(script, avatarWpm(personaRef.current), lineLength);
    playbackStart.current = undefined; onCaption("");
  };
  const [status, setStatus] = useState("Joining your video meeting…");
  const [ready, setReady] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  useImperativeHandle(ref, () => ({ speak: async script => {
    const current = model.current;
    if (!current || !ready) throw new Error("Avatar is still connecting. Your text answer is available below.");
    if (running.current) { await current.stop(); running.current = false; }
    await meetingStep("Apply voice settings", () => voiceSettings.current.apply(current, personaRef.current));
    const accepted = await meetingStep("Set answer script", () => current.setScript({ script }));
    if (!accepted) throw new Error("Reactor did not accept the answer script. Rejoin to retry.");
    prepareCaptions(script);
    await meetingStep("Start video answer", () => current.start());
    if (current.getLastError()) throw new Error("Reactor could not start the video answer. Rejoin to retry.");
    running.current = true;
    onState("speaking");
    setStatus("Preparing voice and video…");
    await video.current?.play().catch(() => setStatus("Press play on the video to hear the avatar."));
  }, stop: async () => {
    cues.current = []; playbackStart.current = undefined; onCaption("");
    video.current?.pause();
    if (running.current && model.current) { await model.current.stop(); running.current = false; onState("ready"); setStatus("Response stopped. Ready for your next question."); }
  } }), [ready, onState, onCaption]);
  useEffect(() => {
    let cancelled = false;
    let client: Ltx2Model | undefined;
    let failed = false;
    const started = Date.now();
    const attemptId = crypto.randomUUID();
    let stage = "Load video client";
    const log = (outcome: string, code?: string) => console.info("[reactor-meeting]", JSON.stringify({ attemptId, model: "reactor/ltx2", stage, outcome, code, elapsedMs: Date.now() - started }));
    async function step<T>(label: string, task: () => Promise<T>, timeoutMs?: number) {
      stage = label;
      if (cancelled || failed) throw new Error("Meeting startup cancelled.");
      setStatus(`${label}…`); log("started");
      const result = await meetingStep(label, task, timeoutMs);
      if (cancelled || failed) throw new Error("Meeting startup cancelled.");
      log("ok");
      return result;
    }
    const stream = new MediaStream();
    const initialPersona = personaRef.current;
    onCaption("");
    onState("connecting");
    const timer = setTimeout(onClose, Math.max(0, Math.min(expiresAt * 1000 - Date.now() - 5000, 600000)));
    async function connect() {
      try {
        const { Ltx2Model } = await step("Load video client", () => import("@reactor-models/ltx2/core"));
        if (cancelled) return;
        client = new Ltx2Model(); model.current = client;
        voiceSettings.current = new AvatarVoiceSettings();
        const attach = (track: MediaStreamTrack) => { if (cancelled || failed) return; stream.addTrack(track); if (video.current) video.current.srcObject = stream; };
        client.onMainVideo(attach); client.onMainAudio(attach);
        client.on("statusChanged", status => { log(`transport:${status}`); });
        client.on("error", error => { log("sdk-error", error.code); if (!cancelled) { failed = true; setReady(false); onState("error"); setStatus(`Meeting failed during ${stage} (${error.code}). Leave and rejoin to retry.`); void client?.disconnect().catch(() => undefined); } });
        client.onCommandError(() => { log("command-rejected"); if (!cancelled) { failed = true; setReady(false); onState("error"); setStatus(`A model command was rejected during ${stage}. Leave and rejoin to retry.`); void client?.disconnect().catch(() => undefined); } });
        client.onGenerationFailed(() => { log("generation-failed"); running.current = false; if (!cancelled && !failed) { cues.current = []; onCaption(""); onState("ready"); setStatus("Video generation failed. Your text answer is still available; try another question."); } });
        client.onGenerationStarted(() => { log("generation-started"); if (!cancelled && !failed) { running.current = true; onState("speaking"); setStatus("Your avatar is preparing its video answer…"); } });
        client.onGenerationStopped(() => { log("generation-stopped"); running.current = false; if (!cancelled && !failed) { onState("ready"); setStatus("Ready for your next question."); } });
        client.onGenerationComplete(() => { log("generation-complete"); running.current = false; if (!cancelled && !failed) { onState("ready"); setStatus("Ready for your next question."); } });
        await step("Connect to Reactor", () => client!.connect(jwt), 60000);
        if (cancelled) return;
        const match = image.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
        if (!match) throw new Error("Avatar image is invalid.");
        const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
        const file = await step("Upload avatar image", () => client!.uploadFile(new Blob([bytes], { type: match[1] })), 45000);
        if (cancelled) return;
        await step("Set avatar image", async () => { if (!await client!.setAvatarImage({ avatar_image: file })) throw new Error("Reactor did not accept the avatar image."); });
        await step("Apply voice casting and pace", () => voiceSettings.current.apply(client!, initialPersona));
        await step("Enable video", () => client!.resumeTrack("main_video")); await step("Enable audio", () => client!.resumeTrack("main_audio"));
        const welcome = await step("Start avatar welcome", () => startMeetingWelcome(client!, initialPersona.name), 90000);
        prepareCaptions(welcome);
        if (!cancelled) {
          running.current = true; setReady(true); onState("speaking");
          setStatus("Connected. Preparing your avatar’s welcome…"); log("ready");
          setHasVideo(true);
          await video.current?.play().catch(() => { if (!cancelled) setStatus("Connected. Press play on the video to enable sound."); });
        }
      } catch (error) {
        failed = true; log(cancelled ? "cancelled" : "error");
        if (!cancelled) { setReady(false); onState("error"); setStatus(error instanceof Error && /Session limit|403/.test(error.message) ? "This meeting session is no longer available. Rejoin to start a new session." : error instanceof Error ? `Could not join: ${error.message}. Rejoin to retry.` : "Could not connect to Reactor. Rejoin to retry."); }
        void client?.disconnect().catch(() => undefined);
        if (model.current === client) model.current = null;
      }
    }
    void connect();
    return () => { cancelled = true; clearTimeout(timer); model.current = null; onCaption(""); void client?.disconnect().catch(() => undefined); stream.getTracks().forEach(track => track.stop()); };
    // Persona edits are applied to the next take without spending a new session.
  }, [jwt, expiresAt, image, onClose, onState, onCaption]);
  return <div className="reactor-player"><div className="meeting-video"><video ref={video} poster={image} muted={muted} controls={hasVideo} playsInline aria-label="Live repository avatar" onPause={() => onCaption("")} onEnded={() => onCaption("")} onTimeUpdate={event => { if (playbackStart.current !== undefined && !event.currentTarget.paused) onCaption(captionAt(cues.current, event.currentTarget.currentTime - playbackStart.current)); }} onPlaying={event => { playbackStart.current ??= event.currentTarget.currentTime; onCaption(captionAt(cues.current, event.currentTarget.currentTime - playbackStart.current)); setHasVideo(true); setStatus("Your avatar is speaking. Use Ask by voice to interrupt and ask a question."); }} /><span className="participant-name">{persona.name}</span></div><div><span role="status">{status}</span></div><small>Video and voice powered by Reactor · Sessions last up to 10 minutes.</small></div>;
});
