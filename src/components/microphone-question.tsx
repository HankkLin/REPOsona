"use client";
import { useEffect, useRef, useState } from "react";
import { CallIcon } from "./meeting-tools";

export function MicrophoneQuestion({ projectId, disabled, onQuestion, onError, onStart, onActivity }: { projectId: string; disabled: boolean; onQuestion: (question: string) => void; onError: (message: string) => void; onStart: () => Promise<void>; onActivity: (active: boolean) => void }) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const [state, setState] = useState<"idle" | "permission" | "recording" | "transcribing">("idle");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); clearTimeout(timer.current); if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); onActivity(false); }; }, [onActivity]);
  async function record() {
    setState("permission"); onActivity(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Microphone recording is unavailable in this browser. Please type your question.");
      await onStart();
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!mounted.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("This browser cannot record a supported format. Please type your question.");
      const current = new MediaRecorder(media, { mimeType }); recorder.current = current;
      const chunks: Blob[] = [];
      current.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      current.onerror = () => { onError("Microphone recording failed. Please try again."); if (current.state === "recording") current.stop(); };
      current.onstop = async () => {
        clearTimeout(timer.current); media.getTracks().forEach(t => t.stop());
        if (!mounted.current) return;
        setState("transcribing");
        try {
          const form = new FormData(); form.append("audio", new Blob(chunks, { type: mimeType }), "question");
          request.current = new AbortController();
          const response = await fetch(`/api/projects/${projectId}/transcription`, { method: "POST", body: form, signal: AbortSignal.any([request.current.signal, AbortSignal.timeout(60000)]) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Transcription failed.");
          if (mounted.current) onQuestion(result.transcript);
        } catch (error) { if (mounted.current) onError(error instanceof Error ? error.message : "Transcription failed."); }
        finally { if (mounted.current) { setState("idle"); onActivity(false); } }
      };
      current.start(); setState("recording"); timer.current = setTimeout(() => current.state === "recording" && current.stop(), 60000);
    } catch (error) {
      stream.current?.getTracks().forEach(t => t.stop());
      if (mounted.current) { setState("idle"); onActivity(false); onError(error instanceof Error && error.name === "NotAllowedError" ? "Microphone permission was denied. Enable it in your browser or type your question." : error instanceof Error ? error.message : "Could not access your microphone."); }
    }
  }
  return <div className="microphone-control"><button type="button" className={`meeting-control microphone-button ${state === "recording" ? "recording" : ""}`} aria-pressed={state === "recording"} aria-describedby="microphone-status" disabled={state === "idle" ? disabled : state !== "recording"} onClick={() => state === "recording" ? recorder.current?.stop() : void record()}><CallIcon name={state === "recording" ? "stop" : "mic"} /><span>{state === "recording" ? "Finish question" : state === "permission" ? "Allow microphone…" : state === "transcribing" ? "Transcribing…" : "Ask by voice"}</span></button><span id="microphone-status" role="status">{state === "recording" ? "Listening · up to 60 seconds. Finish to send your question." : state === "transcribing" ? "Question received. Turning your speech into text…" : "Your microphone stays off until you ask by voice."}</span></div>;
}
