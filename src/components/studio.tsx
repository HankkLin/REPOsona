"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Answer, AnswerMode } from "@/domain/schemas";
import { importStages, readImportProgress, type ImportStage, type ViewProject } from "@/domain/import-progress";
import { ReactorAvatar, type ReactorHandle, type ReactorState } from "./reactor-avatar";
import { MicrophoneQuestion } from "./microphone-question";
import { MeetingTools, CallIcon } from "./meeting-tools";
import { VoiceDirection } from "./voice-direction";
import { captionAt, captionCues } from "./meeting-captions";
import { avatarWpm } from "./meeting-voice";
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
  const [captions, setCaptions] = useState(true);
  const [caption, setCaption] = useState("");
  const [muted, setMuted] = useState(false);
  // The right side of the meeting shows one panel at a time, like a video call: the chat or the settings.
  const [panel, setPanel] = useState<"chat" | "settings" | null>("chat");
  const [meetingEnded, setMeetingEnded] = useState(false);
  const call = useRef<HTMLDivElement>(null);
  const reactor = useRef<ReactorHandle>(null);
  const pending = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const closeReactor = useCallback(() => { setReactorSession(undefined); setReactorState("connecting"); setCaption(""); }, []);
  const endMeeting = useCallback(() => { setMeetingEnded(true); closeReactor(); }, [closeReactor]);
  const stopSpeech = useCallback(() => {
    audio.current?.pause(); window.speechSynthesis?.cancel(); setSpeaking(false); setAudioSrc(""); setCaption("");
  }, []);
  useEffect(() => {
    if (step === "talk" && project?.approvedAvatarId && !project.demo) {
      setMeetingEnded(false);
      void join();
    }
    // Entering Talk owns session startup; other project updates must not reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, project?.id, project?.approvedAvatarId, project?.demo]);
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
  const questionDisabled = !!busy || micActive || meetingEnded || (!!reactorSession && !callReady);
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
  async function previewVoice() {
    await run("Previewing the saved voice…", async () => {
      stopSpeech(); await reactor.current?.stop();
      if (!reactor.current) throw new Error("Wait for the avatar to connect before previewing its voice.");
      await reactor.current.speak("Hello there. Take a breath, and let’s explore this repository together. Small ideas can turn into something wonderful.");
    });
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
      try {
        const session = await api<{ mode: string; jwt?: string; expiresAt?: number }>(`/api/projects/${project!.id}/actions`, { action: "session" });
        if (!session.jwt || !session.expiresAt) throw new Error("Video meetings require live mode. Demo questions are available in text.");
        stopSpeech(); setReactorState("connecting"); setReactorSession({ jwt: session.jwt, expiresAt: session.expiresAt });
      } catch (error) { setReactorState("error"); throw error; }
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
        const cues = captionCues(result.answer, avatarWpm(project!.persona));
        utterance.onstart = () => { setSpeaking(true); setCaption(captionAt(cues, 0)); };
        utterance.onboundary = event => setCaption(captionAt(cues, event.elapsedTime));
        utterance.onend = utterance.onerror = () => { setSpeaking(false); setCaption(""); };
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
          return <li key={s.id}><button type="button" className={`${s.id === step ? "current" : ""} ${i < index ? "done" : ""}`} aria-current={s.id === step ? "step" : undefined} disabled={!reachable || !!busy || micActive} onClick={() => { if (s.id !== step) { stopSpeech(); closeReactor(); setStep(s.id); } }}><span>{i + 1}</span>{s.label}</button></li>;
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
          <VoiceDirection key={project.id} direction={project.persona.voice.direction} wpm={project.persona.voice.wpm} disabled={!!busy} demo={project.demo} onSave={direction => savePersona({ voice: { direction } })} />
        </div>
      </div>}

      {step === "talk" && project.approvedAvatarId && <div ref={call} className={`call meeting-room ${panel ? "with-panel" : ""}`}>
        <div className="meeting-heading"><div><span className="eyebrow">REPOSITORY MEETING</span><h2>In conversation with {project.persona.name}</h2></div><span className="meeting-badge">{project.demo ? "Demo preview" : meetingEnded ? "Meeting ended" : reactorState === "error" ? "Connection failed" : reactorSession && callReady ? "Live · Reactor" : "Connecting to Reactor…"}</span></div>
        <div className={`call-stage ${talking ? "speaking" : ""} ${reactorSession ? "live" : ""} ${meetingEnded ? "ended" : ""}`}>
          {reactorSession
            ? <ReactorAvatar ref={reactor} {...reactorSession} muted={muted} image={approved!.image} persona={project.persona} onClose={endMeeting} onState={setReactorState} onCaption={setCaption} />
            : <img src={approved!.image} alt={`${project.persona.name} avatar`} />}
          <div className="call-tag"><strong>{project.persona.name}</strong><span>{project.persona.archetype || "Repository persona"}</span></div>
          <span className="call-state">{micActive ? "Microphone active" : thinking ? "Thinking…" : talking ? "Speaking" : project.demo ? "Demo preview" : reactorState === "error" ? "Connection failed" : !reactorSession ? meetingEnded ? "Meeting ended" : "Connecting…" : "Ready for your question"}</span>
          {captions && caption && !meetingEnded && <p className="call-subtitle" key={caption}>{caption}</p>}
          {meetingEnded && <div className="meeting-goodbye" role="status"><span className="goodbye-wave" aria-hidden="true">👋</span><h2>Bye, c u next time</h2><p>Your repository will be right here.</p></div>}
          {!reactorSession && !project.demo && !meetingEnded && <div className="meeting-lobby" role="status">{busy.startsWith("Joining") ? <><span className="spinner" />Starting your live avatar…</> : "Your live avatar will appear here once connected."}</div>}
        </div>

        <div className="call-controls">
          <MeetingTools key={`${project.id}-${reactorSession ? "live" : meetingEnded ? "ended" : "lobby"}`}>
            <MicrophoneQuestion projectId={project.id} disabled={project.demo || meetingEnded || questionDisabled || !reactorSession || !callReady} onActivity={setMicActive} onStart={async () => { setError(""); stopSpeech(); await reactor.current?.stop(); }} onQuestion={text => void ask(text)} onError={setError} />
            <button type="button" className="meeting-control" aria-pressed={muted} onClick={() => setMuted(value => !value)}><CallIcon name="speaker" /><span>{muted ? "Sound off" : "Sound on"}</span></button>
            <button type="button" className="meeting-control" aria-pressed={captions} onClick={() => setCaptions(value => !value)}><CallIcon name="captions" /><span>Captions</span></button>
            <button type="button" className="meeting-control" aria-pressed={panel === "chat"} aria-controls="meeting-chat" onClick={() => setPanel(value => value === "chat" ? null : "chat")}><CallIcon name="chat" /><span>Chat</span></button>
            <button type="button" className="meeting-control" aria-pressed={panel === "settings"} aria-controls="meeting-settings" onClick={() => setPanel(value => value === "settings" ? null : "settings")}><CallIcon name="settings" /><span>Settings</span></button>
            <button type="button" className="meeting-control" onClick={() => { void (document.fullscreenElement ? document.exitFullscreen() : call.current?.requestFullscreen())?.catch(() => setError("Fullscreen is unavailable in this browser.")); }}><CallIcon name="fullscreen" /><span>Fullscreen</span></button>
            <button type="button" className="meeting-control" disabled={!!busy || micActive || !talking} onClick={() => void run("Stopping the avatar’s response…", async () => { stopSpeech(); await reactor.current?.stop(); })}><CallIcon name="stop" /><span>Stop answer</span></button>
            <button type="button" className="meeting-control meeting-leave" disabled={!!busy || micActive || meetingEnded} onClick={() => { stopSpeech(); setMeetingEnded(true); closeReactor(); }}><CallIcon name="leave" /><span>Leave</span></button>
          </MeetingTools>
          {!project.demo && !busy && (meetingEnded || reactorState === "error") && <div className="meeting-options"><button type="button" onClick={() => { closeReactor(); setMeetingEnded(false); void join(); }}>Rejoin meeting</button></div>}
        </div>
        {audioSrc && <audio ref={audio} src={audioSrc} muted={muted} controls autoPlay onPlay={() => setSpeaking(true)} onTimeUpdate={event => setCaption(captionAt(captionCues(latestAnswer?.text || "", avatarWpm(project.persona)), event.currentTarget.currentTime))} onPause={() => { setSpeaking(false); setCaption(""); }} onEnded={() => { setSpeaking(false); setCaption(""); }} aria-label="Persona voice reading the answer" />}

        {panel === "chat" && <aside id="meeting-chat" className="meeting-panel meeting-chat" aria-label={`Chat with ${project.persona.name}`}>
          <div className="meeting-panel-head"><div><h3>Chat</h3><p>Ask {project.persona.name} about its README. Answers cite the lines they use.</p></div><button type="button" className="meeting-panel-close" aria-label="Close chat" onClick={() => setPanel(null)}><CallIcon name="close" /></button></div>
          <div ref={transcript} className="messages" aria-live="polite">{messages.length === 0 && <p className="empty-chat">“How do I get started?” is a good place to start.</p>}{messages.map((m, i) => <div key={i} className={`message ${m.role}`}><strong>{m.role === "user" ? "You" : project.persona.name}</strong><p>{m.text}</p>{m.citations?.map((c, j) => <details key={j}><summary>README lines {c.startLine}–{c.endLine}</summary><pre>{project.repository.readme.split("\n").slice(c.startLine - 1, c.endLine).join("\n")}</pre><a href={`${project.repository.sourceUrl}#L${c.startLine}-L${c.endLine}`} target="_blank" rel="noreferrer">View source ↗</a></details>)}</div>)}{thinking && <div className="message thinking"><span className="spinner" /><p>Question received. Checking my README…</p></div>}</div>
          <form className="meeting-composer" onSubmit={e => { e.preventDefault(); void ask(); }}><input aria-label="Question about the repository" value={question} onChange={e => setQuestion(e.target.value)} placeholder={reactorSession && !callReady ? "Connecting your avatar…" : `Message ${project.persona.name}`} maxLength={2000} disabled={questionDisabled} /><button aria-label="Send question" disabled={questionDisabled || !question.trim()}>{thinking ? <span className="spinner" /> : <CallIcon name="send" />}</button></form>
          <small>{reactorSession ? "Or press Ask by voice, speak, then Finish question." : project.demo ? "Demo speech uses your browser’s voices. Video and voice questions need live mode." : "Your microphone is available once the avatar connects."}</small>
        </aside>}

        {panel === "settings" && <aside id="meeting-settings" className="meeting-panel meeting-settings" aria-label="Meeting settings">
          <div className="meeting-panel-head"><div><h3>Settings</h3><p>Tune how {project.persona.name} answers and sounds.</p></div><button type="button" className="meeting-panel-close" aria-label="Close settings" onClick={() => setPanel(null)}><CallIcon name="close" /></button></div>
          <div className="meeting-setting"><label htmlFor="answer-mode">Answer style</label><select id="answer-mode" value={answerMode} disabled={!!busy || micActive} onChange={e => setAnswerMode(e.target.value as AnswerMode)}><option value="flash">Quick answer</option><option value="pro">Deep analysis</option></select></div>
          {!reactorSession && <label className="voice-toggle meeting-setting"><input type="checkbox" checked={voice} onChange={e => { setVoice(e.target.checked); if (!e.target.checked) stopSpeech(); }} />Read answers aloud</label>}
          <VoiceDirection key={project.id} direction={project.persona.voice.direction} wpm={project.persona.voice.wpm} disabled={!!busy || micActive || meetingEnded} demo={project.demo} onSave={direction => savePersona({ voice: { direction } })} onPreview={project.demo ? undefined : () => void previewVoice()} previewDisabled={!reactorSession || !callReady} />
          <button type="button" className="secondary meeting-edit" disabled={!!busy || micActive} onClick={() => { closeReactor(); setStep("refine"); }}>← Edit persona</button>
        </aside>}
      </div>}
    </section>}
    {(busy || error) && <div className={`status ${error ? "error" : ""}`} role={error ? "alert" : "status"} aria-live="polite">{busy && <span className="spinner" />}<div>{busy || error}{busy && <small>{elapsed}s elapsed · Your request is being processed.</small>}</div></div>}
    <footer>Every repository has a story. Give yours a voice.<span>Human README · Meet your code</span></footer>
  </main>;
}
