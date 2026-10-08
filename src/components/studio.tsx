"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Answer, AnswerMode } from "@/domain/schemas";
import { importStages, readImportProgress, type ImportStage, type ViewProject } from "@/domain/import-progress";
import { ReactorAvatar, type ReactorHandle, type ReactorState } from "./reactor-avatar";
import { MicrophoneQuestion } from "./microphone-question";
import { IntroChat } from "./intro-chat";
import { PersonaCard, type PersonaPatch } from "./persona-card";
import { personaMarkdown } from "@/server/persona-markdown";

type Step = "meet" | "refine" | "talk";
const STEPS: { id: Step; label: string }[] = [{ id: "meet", label: "Meet" }, { id: "refine", label: "Refine" }, { id: "talk", label: "Talk" }];
const startStep = (p: ViewProject): Step => p.approvedAvatarId ? "talk" : p.avatars.length ? "refine" : "meet";
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
  const [step, setStep] = useState<Step>("meet");
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
  const [speaking, setSpeaking] = useState(false);
  const [reactorSession, setReactorSession] = useState<{ jwt: string; expiresAt: number }>();
  const [reactorState, setReactorState] = useState<ReactorState>("connecting");
  const [micActive, setMicActive] = useState(false);
  const reactor = useRef<ReactorHandle>(null);
  const pending = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const closeReactor = useCallback(() => { setReactorSession(undefined); setReactorState("connecting"); }, []);
  const stopSpeech = useCallback(() => {
    audio.current?.pause(); window.speechSynthesis?.cancel(); setSpeaking(false); setAudioSrc("");
  }, []);
  useEffect(() => {
    const id = localStorage.getItem("human-readme-project");
    if (id) { setBusy("Restoring your studio…"); api<ViewProject>(`/api/projects/${id}`).then(p => { setProject(p); setStep(startStep(p)); }).catch(e => {
      // Forget the saved project only when the server says it is gone; keep it through transient errors.
      if (e instanceof Error && e.message.startsWith("Project not found")) localStorage.removeItem("human-readme-project");
      else setError("Couldn't reopen your project. Refresh to try again.");
    }).finally(() => setBusy("")); }
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
  const latestAnswer = messages.findLast(m => m.role === "avatar");
  const avatar = project?.avatars.find(a => a.id === (selected || project.approvedAvatarId)) || project?.avatars.at(-1);
  const approved = project?.avatars.find(a => a.id === project.approvedAvatarId);
  const callReady = reactorState === "ready" || reactorState === "speaking";
  const questionDisabled = !!busy || micActive || (!!reactorSession && !callReady);
  const thinking = busy.startsWith("Question");
  const talking = speaking || (!!reactorSession && reactorState === "speaking");
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
      stopSpeech(); setProject(result); setSelected(""); setMessages([]); closeReactor(); setStep(startStep(result));
      localStorage.setItem("human-readme-project", result.id);
    });
    setImportStage(undefined);
  }
  async function action(body: unknown) {
    const result = await api<ViewProject>(`/api/projects/${project!.id}/actions`, body);
    stopSpeech(); setProject(result); closeReactor(); return result;
  }
  async function savePersona(persona: PersonaPatch) {
    let saved = false;
    await run("Saving your edit…", async () => { setProject(await api<ViewProject>(`/api/projects/${project!.id}/actions`, { action: "persona", persona })); saved = true; });
    return saved;
  }
  async function makeFace(twist: string) {
    await run(project!.avatars.length ? "Refining the face…" : "Giving it a face…", async () => {
      const result = await action({ action: "generate", suggestion: twist });
      setSelected(result.avatars.at(-1)!.id); setSuggestion(""); setStep("refine");
    });
  }
  async function goTalk() {
    if (avatar && project!.approvedAvatarId !== avatar.id) await run("Saving your favorite…", async () => { await action({ action: "approve", avatarId: avatar.id }); });
    setStep("talk");
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
      else if (voice && !project!.demo) {
        const speech = await api<{ audio: string }>(`/api/projects/${project!.id}/actions`, { action: "speech", text: result.answer });
        setAudioSrc(speech.audio);
      } else if (voice && project!.demo && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(result.answer);
        utterance.lang = project!.persona.voice.language; utterance.rate = project!.persona.voice.rate; utterance.pitch = project!.persona.voice.pitch;
        utterance.onstart = () => setSpeaking(true); utterance.onend = utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    });
  }
  return <main aria-busy={!!busy}>
    <header className="topbar"><button className="brand" disabled={!!busy || micActive} onClick={() => { stopSpeech(); setProject(undefined); closeReactor(); localStorage.removeItem("human-readme-project"); }}>human<span>readme</span><sup>✦</sup></button><span className={`mode ${demo ? "demo" : ""}`}>{demo ? "Demo playground" : "Live studio"}</span></header>
    {!project ? <section className="hero">
      <IntroChat />
      <div className="eyebrow">YOUR CODE HAS A CHARACTER</div>
      <h1>Meet the personality<br />behind your <span>repository.</span></h1>
      <p>A README becomes a persona, a face, and a conversation.<br />Discover the character behind your code.</p>
      <form className="search" onSubmit={e => { e.preventDefault(); void create(); }}><span aria-hidden>⌕</span><input aria-label="GitHub repository URL" type="url" required placeholder="https://github.com/you/something-great" value={url} onChange={e => setUrl(e.target.value)} disabled={!!busy} /><button disabled={!!busy}>{busy ? <><span className="spinner" />Creating your character…</> : <>Bring it to life <span>↗</span></>}</button></form>
      {importStage && <div className="import-progress" role="status" aria-live="polite"><strong>Repository received</strong><p>{url}</p><ol>{importStages.map((stage, i) => <li key={stage} className={i < importStages.indexOf(importStage) ? "done" : stage === importStage ? "active" : ""}><span>{i < importStages.indexOf(importStage) ? "✓" : stage === importStage ? <span className="spinner" /> : i + 1}</span>{progressLabels[stage]}</li>)}</ol><small>{elapsed}s elapsed · Image generation can take a minute. You can keep this tab open.</small></div>}
      <button className="example" disabled={!!busy} onClick={() => setUrl("https://github.com/vercel/next.js")}>Try a repository: vercel / next.js ↗</button>
      <div className="journey"><span>01 <b>Meet the persona</b></span><i>→</i><span>02 <b>Give it a face</b></span><i>→</i><span>03 <b>Talk to it</b></span></div>
      {demo && <p className="demo-note">Demo uses sample repository content and an illustrative portrait. Live mode creates your character with Gemini.</p>}
    </section> : <section className="workspace">
      <nav className="stepper" aria-label="Studio steps">
        <a className="stepper-repo" href={project.repository.url} target="_blank" rel="noreferrer">{project.repository.owner}/{project.repository.name} ↗</a>
        <ol>{STEPS.map((s, i) => {
          const reachable = s.id === "meet" || (s.id === "refine" && project.avatars.length > 0) || (s.id === "talk" && !!project.approvedAvatarId);
          const index = STEPS.findIndex(x => x.id === step);
          return <li key={s.id}><button type="button" className={`${s.id === step ? "current" : ""} ${i < index ? "done" : ""}`} aria-current={s.id === step ? "step" : undefined} disabled={!reachable || !!busy || micActive} onClick={() => setStep(s.id)}><span>{i + 1}</span>{s.label}</button></li>;
        })}</ol>
      </nav>

      {step === "meet" && <article className="meet">
        <div className="meet-mark" aria-hidden>{project.persona.name.charAt(0)}</div>
        <p className="eyebrow">Persona found</p>
        <h1>{project.persona.name}</h1>
        <p className="meet-role">{project.persona.archetype || "Repository persona"}</p>
        <blockquote className="persona-quote">“{project.persona.tagline}”</blockquote>
        <div className="chips">{project.persona.traits.map(t => <span key={t}>{t}</span>)}</div>
        <p className="meet-bio">{project.persona.backstory}</p>
        {(project.persona.goals?.length || project.persona.frustrations?.length || project.persona.audience) ? <div className="meet-grid">
          {project.persona.goals?.length ? <div><h3>Goals</h3><ul>{project.persona.goals.map(g => <li key={g}>{g}</li>)}</ul></div> : null}
          {project.persona.frustrations?.length ? <div className="frustrations"><h3>Frustrations</h3><ul>{project.persona.frustrations.map(f => <li key={f}>{f}</li>)}</ul></div> : null}
          {project.persona.audience ? <div className="audience"><h3>Who I&apos;m for</h3><p>{project.persona.audience}</p></div> : null}
        </div> : null}
        <div className="meet-actions">
          {project.avatars.length ? <button onClick={() => setStep("refine")}>Back to refining →</button> : <button disabled={!!busy} onClick={() => void makeFace("")}>Give it a face ✦</button>}
        </div>
        {project.repository.truncated && <p className="meet-note">README was limited to 60,000 characters.</p>}
      </article>}

      {step === "refine" && <div className="split">
        <aside className="split-side">
          <article className="card avatar">
            <div className="card-label"><span className="label-title">Face</span><span>{project.avatars.length ? `V${project.avatars.indexOf(avatar!) + 1}` : ""}</span></div>
            <div className="avatar-stage"><img key={avatar?.id ?? "reference"} src={avatar?.image || "/api/reference"} alt={`${project.persona.name} avatar`} /><span className="stage-caption">{project.approvedAvatarId === avatar?.id && avatar ? "Approved ✦" : project.demo ? "Demo preview" : "A little code. A lot of character."}</span>{busy.startsWith("Refining") && <div className="avatar-loading" role="status"><span className="spinner" /><strong>Twist received</strong><span>Creating a new version…</span></div>}</div>
            <h2 className="side-name">{project.persona.name}</h2>
            <p className="side-role">{project.persona.archetype || "Repository persona"}</p>
            {project.avatars.length > 1 && <div className="versions">{project.avatars.map((a, i) => <button key={a.id} className={avatar?.id === a.id ? "active" : ""} onClick={() => setSelected(a.id)} disabled={!!busy}>V{i + 1}</button>)}</div>}
            <form onSubmit={e => { e.preventDefault(); void makeFace(suggestion); }}><label htmlFor="suggestion">Give it your own twist</label><textarea id="suggestion" placeholder="A teal hoodie, a curious expression, a tiny rocket…" value={suggestion} onChange={e => setSuggestion(e.target.value)} maxLength={1000} disabled={!!busy} /><div className="actions"><button className="secondary" disabled={!!busy}>Refine face ↻</button><button type="button" disabled={!!busy || !avatar} onClick={() => void goTalk()}>Talk to it →</button></div></form>
          </article>
        </aside>
        <div className="split-main">
          <PersonaCard persona={project.persona} repository={project.repository} photo={avatar?.image || "/api/reference"} disabled={!!busy} onDownload={downloadPersona} onSave={savePersona} />
        </div>
      </div>}

      {step === "talk" && project.approvedAvatarId && <div className="call">
        <div className={`call-stage ${talking ? "speaking" : ""} ${reactorSession ? "live" : ""}`}>
          {reactorSession
            ? <ReactorAvatar ref={reactor} {...reactorSession} image={approved!.image} persona={project.persona} onClose={closeReactor} onState={setReactorState} />
            : <img src={approved!.image} alt={`${project.persona.name} avatar`} />}
          <div className="call-tag"><strong>{project.persona.name}</strong><span>{project.persona.archetype || "Repository persona"}</span></div>
          <span className="call-state">{thinking ? "Thinking…" : talking ? "Speaking" : "Listening"}</span>
          {latestAnswer && <p className="call-subtitle" key={messages.length}>{latestAnswer.text}</p>}
        </div>

        <form className="chat-input call-ask" onSubmit={e => { e.preventDefault(); void ask(); }}><input aria-label="Question about the repository" value={question} onChange={e => setQuestion(e.target.value)} placeholder={reactorSession && !callReady ? "Connecting your avatar…" : `Ask ${project.persona.name} anything about its README…`} maxLength={2000} disabled={questionDisabled} /><button disabled={questionDisabled || !question.trim()}>{thinking ? "Answering…" : "Ask ↗"}</button></form>

        <div className="call-controls">
          <button type="button" className="secondary" disabled={!!busy || micActive} onClick={() => { closeReactor(); setStep("refine"); }}>← Edit persona</button>
          <div className="answer-controls"><label htmlFor="answer-mode">Answer style</label><select id="answer-mode" value={answerMode} disabled={!!busy || micActive} onChange={e => setAnswerMode(e.target.value as AnswerMode)}><option value="flash">Quick answer</option><option value="pro">Deep analysis</option></select></div>
          <label className="voice-toggle"><input type="checkbox" checked={voice} disabled={!!reactorSession} onChange={e => { setVoice(e.target.checked); if (!e.target.checked) stopSpeech(); }} />Read answers aloud</label>
          {!project.demo && reactorSession && <MicrophoneQuestion projectId={project.id} disabled={questionDisabled || !callReady} onActivity={setMicActive} onStart={async () => { setError(""); stopSpeech(); await reactor.current?.stop(); }} onQuestion={text => void ask(text)} onError={setError} />}
          {reactorSession ? reactorState === "error"
            ? <button type="button" disabled={!!busy} onClick={() => { closeReactor(); void join(); }}>Rejoin meeting</button>
            : <button type="button" className="secondary" disabled={!callReady || !!busy || micActive} onClick={() => void run("Stopping the avatar’s response…", async () => { await reactor.current?.stop(); })}>Stop answer</button>
            : <button type="button" className="secondary" disabled={!!busy || project.demo} title={project.demo ? "Video meetings are available in live mode." : undefined} onClick={() => void join()}>{busy.startsWith("Joining") ? <><span className="spinner" />Joining…</> : "Join video meeting ↗"}</button>}
        </div>
        {audioSrc && <audio ref={audio} src={audioSrc} controls autoPlay onPlay={() => setSpeaking(true)} onPause={() => setSpeaking(false)} onEnded={() => setSpeaking(false)} aria-label="Persona voice reading the answer" />}

        <section className="card call-transcript">
          <div className="card-label"><span className="label-title">Transcript</span><span>My personality adds flavor. My README supplies the facts.</span></div>
          <div ref={transcript} className="messages" aria-live="polite">{messages.length === 0 && <p className="empty-chat">“How do I get started?” is a good place to start.</p>}{messages.map((m, i) => <div key={i} className={`message ${m.role}`}><strong>{m.role === "user" ? "You" : project.persona.name}</strong><p>{m.text}</p>{m.citations?.map((c, j) => <details key={j}><summary>README lines {c.startLine}–{c.endLine}</summary><pre>{project.repository.readme.split("\n").slice(c.startLine - 1, c.endLine).join("\n")}</pre><a href={`${project.repository.sourceUrl}#L${c.startLine}-L${c.endLine}`} target="_blank" rel="noreferrer">View source ↗</a></details>)}</div>)}{thinking && <div className="message thinking"><span className="spinner" /><p>Question received. Checking my README…</p></div>}</div>
          <small>{reactorSession ? "Camera off · Your microphone stays off until you press “Ask by voice”." : project.demo ? "Demo speech uses your browser’s available voices. Video meetings and voice questions need live mode." : "Join the video meeting to use your microphone and hear the avatar."}</small>
        </section>
      </div>}
    </section>}
    {(busy || error) && <div className={`status ${error ? "error" : ""}`} role={error ? "alert" : "status"} aria-live="polite">{busy && <span className="spinner" />}<div>{busy || error}{busy && <small>{elapsed}s elapsed · Your request is being processed.</small>}</div></div>}
    <footer>Every repository has a story. Give yours a voice.<span>Human README · Meet your code</span></footer>
  </main>;
}
