"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Answer, AnswerMode } from "@/domain/schemas";
import { importStages, readImportProgress, type ImportStage, type ViewProject } from "@/domain/import-progress";
import { ReactorAvatar, type ReactorHandle, type ReactorState } from "./reactor-avatar";
import { MicrophoneQuestion } from "./microphone-question";
import { personaMarkdown } from "@/server/persona-markdown";

type Message = { role: "user" | "avatar"; text: string; citations?: Answer["citations"] };
const progressLabels: Record<ImportStage, string> = { readme: "Read the repository README", persona: "Discover its personality", embeddings: "Prepare repository knowledge", avatar: "Create its character portrait", save: "Open your studio" };
async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: (body as { action?: string }).action === "session" ? AbortSignal.timeout(25000) : undefined } : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed. Please retry.");
  return result;
}
export function Studio({ demo }: { demo: boolean }) {
  const [url, setUrl] = useState("");
  const [project, setProject] = useState<ViewProject>();
  const [busy, setBusy] = useState("");
  const [importStage, setImportStage] = useState<ImportStage>();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [selected, setSelected] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [voice, setVoice] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("flash");
  const [audioSrc, setAudioSrc] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const [reactorSession, setReactorSession] = useState<{ jwt: string; expiresAt: number }>();
  const [reactorState, setReactorState] = useState<ReactorState>("connecting");
  const [micActive, setMicActive] = useState(false);
  const reactor = useRef<ReactorHandle>(null);
  const pending = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const meeting = useRef<HTMLElement>(null);
  const closeReactor = useCallback(() => { setReactorSession(undefined); setReactorState("connecting"); }, []);
  const stopSpeech = useCallback(() => { audio.current?.pause(); window.speechSynthesis?.cancel(); setAudioSrc(""); }, []);
  useEffect(() => {
    const id = localStorage.getItem("human-readme-project");
    if (id) { setBusy("Restoring your studio…"); api<ViewProject>(`/api/projects/${id}`).then(setProject).catch(() => localStorage.removeItem("human-readme-project")).finally(() => setBusy("")); }
    const player = audio.current;
    return () => { player?.pause(); window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0); const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);
  const avatar = project?.avatars.find(a => a.id === (selected || project.approvedAvatarId)) || project?.avatars.at(-1);
  const approved = project?.avatars.find(a => a.id === project.approvedAvatarId);
  const callReady = reactorState === "ready" || reactorState === "speaking";
  const questionDisabled = !!busy || micActive || (!!reactorSession && !callReady);
  async function run(label: string, task: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(label); setError("");
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { pending.current = false; setBusy(""); }
  }
  async function create() {
    setImportStage("readme");
    await run("Repository received. Creating your persona and image…", async () => {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: JSON.stringify({ url }) });
      const result = await readImportProgress(response, setImportStage);
      stopSpeech(); setProject(result); setSelected(""); setMessages([]); closeReactor();
      localStorage.setItem("human-readme-project", result.id);
    });
    setImportStage(undefined);
  }
  async function action(body: unknown) {
    const result = await api<ViewProject>(`/api/projects/${project!.id}/actions`, body);
    stopSpeech(); setProject(result); closeReactor(); return result;
  }
  function downloadPersona() {
    const blob = new Blob([personaMarkdown(project!.persona)], { type: "text/markdown" });
    const href = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = href; anchor.download = "PERSONA.md"; anchor.click(); URL.revokeObjectURL(href);
  }
  async function join() {
    await run("Joining the meeting. Preparing your avatar…", async () => {
      const session = await api<{ mode: string; jwt?: string; expiresAt?: number }>(`/api/projects/${project!.id}/actions`, { action: "session" });
      if (!session.jwt || !session.expiresAt) throw new Error("Video meetings require live mode. Demo questions are available in text.");
      stopSpeech(); setReactorState("connecting"); setReactorSession({ jwt: session.jwt, expiresAt: session.expiresAt });
    });
  }
  async function ask(input = question) {
    const text = input.trim(); if (!text || pending.current) return;
    // Acknowledge the question immediately, before any model request.
    setMessages(old => [...old, { role: "user", text }]); setQuestion("");
    await run("Question received. Finding a grounded answer…", async () => {
      stopSpeech(); await reactor.current?.stop();
      const result = await api<Answer>(`/api/projects/${project!.id}/actions`, { action: "chat", question: text, mode: answerMode });
      setMessages(old => [...old, { role: "avatar", text: result.answer, citations: result.citations }]);
      if (reactorSession) { if (!reactor.current) throw new Error("The meeting disconnected. Your answer is in the transcript."); await reactor.current.speak(result.answer); }
      else if (voice && !project!.demo) { const speech = await api<{ audio: string }>(`/api/projects/${project!.id}/actions`, { action: "speech", text: result.answer }); setAudioSrc(speech.audio); }
      else if (voice && project!.demo && "speechSynthesis" in window) { const utterance = new SpeechSynthesisUtterance(result.answer); utterance.lang = project!.persona.voice.language; utterance.rate = project!.persona.voice.rate; utterance.pitch = project!.persona.voice.pitch; window.speechSynthesis.speak(utterance); }
    });
  }
  return <main aria-busy={!!busy}>
    <header className="topbar"><button className="brand" disabled={!!busy || micActive} onClick={() => { stopSpeech(); setProject(undefined); closeReactor(); localStorage.removeItem("human-readme-project"); }}>human<span>readme</span><sup>✦</sup></button><span className="mode">{demo ? "Demo playground" : "Live studio"}</span></header>
    {!project ? <section className="hero">
      <div className="eyebrow">YOUR CODE HAS A CHARACTER</div><h1>Meet the personality<br />behind your <span>repository.</span></h1>
      <p>A README becomes a persona, a face, and a conversation.<br />Discover the character behind your code.</p>
      <form className="search" onSubmit={e => { e.preventDefault(); void create(); }}><span aria-hidden>⌕</span><input aria-label="GitHub repository URL" type="url" required placeholder="https://github.com/you/something-great" value={url} onChange={e => setUrl(e.target.value)} disabled={!!busy} /><button disabled={!!busy}>{busy ? <><span className="spinner" />Creating your character…</> : <>Bring it to life <span>↗</span></>}</button></form>
      {importStage && <div className="import-progress" role="status" aria-live="polite"><strong>Repository received</strong><p>{url}</p><ol>{importStages.map((stage, i) => <li key={stage} className={i < importStages.indexOf(importStage) ? "done" : stage === importStage ? "active" : ""}><span>{i < importStages.indexOf(importStage) ? "✓" : stage === importStage ? <span className="spinner" /> : i + 1}</span>{progressLabels[stage]}</li>)}</ol><small>{elapsed}s elapsed · Image generation can take a minute. You can keep this tab open.</small></div>}
      <button className="example" disabled={!!busy} onClick={() => setUrl("https://github.com/vercel/next.js")}>Try a repository: vercel / next.js ↗</button>
      <div className="journey"><span>01 <b>Discover its DNA</b></span><i>→</i><span>02 <b>Confirm its character</b></span><i>→</i><span>03 <b>Meet your repository</b></span></div>
      {demo && <p className="demo-note">Demo uses sample repository content and an illustrative portrait. Live mode creates your character with Gemini.</p>}
    </section> : <section className="workspace">
      <div className="workspace-heading"><div className="eyebrow">YOUR REPOSITORY, PERSONIFIED</div><h1>{project.repository.name}<span className="dot">.</span></h1><a href={project.repository.url} target="_blank" rel="noreferrer">{project.repository.owner} / {project.repository.name} ↗</a>{project.repository.truncated && <p>README was limited to 60,000 characters.</p>}</div>
      <div className="studio-grid">
        <article className="card persona"><div className="card-label">01 / REPO DNA <button className="text-button" onClick={downloadPersona}>↓ PERSONA.md</button></div><h2>{project.persona.name}</h2><p className="tagline">{project.persona.tagline}</p><div className="chips">{project.persona.traits.map(t => <span key={t}>{t}</span>)}</div><p>{project.persona.backstory}</p><h3>What I believe</h3><ul>{project.persona.convictions.map(c => <li key={c}>{c}</li>)}</ul><h3>How I sound</h3><p>{project.persona.voice.tone}</p><small>Fictional personality · repository facts come from the README</small></article>
        <article className="card avatar"><div className="card-label">02 / FIND ITS FACE <span>{avatar ? `V${project.avatars.indexOf(avatar) + 1}` : "YOUR CHARACTER"}</span></div><div className="avatar-stage">{avatar ? <img src={avatar.image} alt="Your repository character portrait" /> : <div className="portrait-placeholder">✦<p>Create a face for this repository</p></div>}<span className="stage-caption">{approved?.id === avatar?.id && avatar ? "Character confirmed · ready to meet" : project.demo ? "Illustrative portrait · demo" : "An original character inspired by your repository"}</span>{busy.startsWith("Designing") && <div className="avatar-loading" role="status"><span className="spinner" /><strong>Suggestion received</strong><span>Creating a new version…</span></div>}</div>
          {project.avatars.length > 1 && <div className="versions">{project.avatars.map((a, i) => <button key={a.id} className={avatar?.id === a.id ? "active" : ""} onClick={() => setSelected(a.id)} disabled={!!busy || micActive}>V{i + 1}</button>)}</div>}
          <form onSubmit={e => { e.preventDefault(); void run("Designing your character. Your changes have been received…", async () => { const result = await action({ action: "generate", suggestion }); setSelected(result.avatars.at(-1)!.id); setSuggestion(""); }); }}><label htmlFor="suggestion">Give it your own twist</label><textarea id="suggestion" placeholder="A thoughtful inventor, warm studio light, a teal jacket…" value={suggestion} onChange={e => setSuggestion(e.target.value)} maxLength={1000} disabled={!!busy || micActive} /><div className="actions"><button className="secondary" disabled={!!busy || micActive}>{busy.startsWith("Designing") ? "Creating version…" : avatar ? "Refine character ↻" : "Generate character ✦"}</button>{avatar && <button type="button" disabled={!!busy || micActive || approved?.id === avatar.id} onClick={() => void run("Confirming your character…", async () => { await action({ action: "approve", avatarId: avatar.id }); requestAnimationFrame(() => meeting.current?.scrollIntoView({ behavior: "smooth", block: "start" })); })}>Confirm & meet ↗</button>}</div></form>
        </article>
      </div>
      <article ref={meeting} className="card conversation" aria-label="Repository video meeting"><div className="card-label">03 / MEET YOUR REPOSITORY <span className={`call-badge ${reactorSession && callReady ? "connected" : ""}`}>{reactorSession ? reactorState === "connecting" ? "Joining…" : reactorState === "error" ? "Connection failed" : "In meeting" : approved ? "Ready to join" : "Confirm a character first"}</span></div>
        {approved ? <><div className="meeting-layout"><div className="meeting-stage">
          {reactorSession ? <ReactorAvatar ref={reactor} {...reactorSession} image={approved.image} persona={project.persona} onClose={closeReactor} onState={setReactorState} /> : <div className="meeting-lobby"><img src={approved.image} alt={`${project.persona.name} is ready to meet`} /><div><h2>Meet {project.persona.name}</h2><p>Ask about the repository by voice or text. Your character answers on video.</p><button disabled={!!busy || project.demo || micActive} onClick={() => void join()}>{busy.startsWith("Joining") ? <><span className="spinner" />Joining…</> : "Join video meeting ↗"}</button>{project.demo && <p>Video meetings and microphone questions are available in live mode.</p>}</div></div>}
          {reactorSession && <div className="meeting-controls">{reactorState === "error" ? <button disabled={!!busy} onClick={() => { closeReactor(); void join(); }}>Rejoin meeting</button> : <button className="secondary" disabled={!callReady || !!busy || micActive} onClick={() => void run("Stopping the avatar’s response…", async () => { await reactor.current?.stop(); })}>Stop answer</button>}<span>Camera off · Your microphone is off until you press “Ask by voice”.</span></div>}
        </div><div className="meeting-chat"><h3>Conversation</h3><div ref={transcript} className="messages" aria-live="polite">{messages.length === 0 && <p className="empty-chat">Try “What does this project do?” or “How do I get started?”</p>}{messages.map((m, i) => <div key={i} className={`message ${m.role}`}><strong>{m.role === "user" ? "You" : project.persona.name}</strong><p>{m.text}</p>{m.citations?.map((c, j) => <details key={j}><summary>README lines {c.startLine}–{c.endLine}</summary><pre>{project.repository.readme.split("\n").slice(c.startLine - 1, c.endLine).join("\n")}</pre><a href={`${project.repository.sourceUrl}#L${c.startLine}-L${c.endLine}`} target="_blank" rel="noreferrer">View source ↗</a></details>)}</div>)}{busy.startsWith("Question") && <div className="message thinking"><span className="spinner" /><p>Question received. Checking my README…</p></div>}</div></div></div>
          <div className="answer-controls"><label htmlFor="answer-mode">Answer style</label><select id="answer-mode" value={answerMode} disabled={!!busy || micActive} onChange={e => setAnswerMode(e.target.value as AnswerMode)}><option value="flash">Quick answer</option><option value="pro">Deep analysis</option></select>{!reactorSession && <label className="voice-toggle"><input type="checkbox" checked={voice} onChange={e => { setVoice(e.target.checked); if (!e.target.checked) stopSpeech(); }} />Read text answers aloud</label>}</div>
          {audioSrc && <audio ref={audio} src={audioSrc} controls autoPlay aria-label="Persona voice reading the answer" />}
          <form className="chat-input" onSubmit={e => { e.preventDefault(); void ask(); }}><input aria-label="Question about the repository" value={question} onChange={e => setQuestion(e.target.value)} placeholder={reactorSession && !callReady ? "Connecting your avatar…" : "Ask your repository a question…"} maxLength={2000} disabled={questionDisabled} /><button disabled={questionDisabled || !question.trim()}>{busy.startsWith("Question") ? "Answering…" : reactorSession ? "Send ↗" : "Ask in text ↗"}</button></form>
          {!project.demo && reactorSession && <MicrophoneQuestion projectId={project.id} disabled={questionDisabled || !callReady} onActivity={setMicActive} onStart={async () => { setError(""); stopSpeech(); await reactor.current?.stop(); }} onQuestion={text => void ask(text)} onError={setError} />}
          <small>Answers are grounded in this repository’s README. Citations stay in the transcript.{!reactorSession && !project.demo ? " Join the video meeting to use your microphone and hear the avatar." : ""}</small>
        </> : <p className="empty-chat">Confirm your character above to open your video meeting.</p>}
      </article>
    </section>}
    {(busy || error) && <div className={`status ${error ? "error" : ""}`} role={error ? "alert" : "status"} aria-live="polite">{busy && <span className="spinner" />}<div>{busy || error}{busy && <small>{elapsed}s elapsed · Your request is being processed.</small>}</div></div>}
    <footer>Every repository has a story. Give yours a voice.<span>Human README · Meet your code</span></footer>
  </main>;
}
