# Human README

Give a GitHub repository an original character, a portrait, and a voice. Import a repository with visible progress, refine and confirm its character, then join a video meeting to ask questions grounded in its README.

Characters default to original non-human mascots, with their form, colors and signature details inspired by repository themes. Image refinements can reinterpret older human portraits as mascots; human form requires an explicit appearance request.

## Run locally

Requires Node.js 22+ and npm.

```bash
npm install
[ -f .env.local ] || cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Demo mode is enabled by default: any valid GitHub repository URL uses a clearly labeled fixture README, a deterministic persona, and a neutral illustrative portrait. Demo refinements create version records but **do not generate new images**. Demo answers match README passages; they are not model output. Demo answers have optional browser text-to-speech.

Imports stream actual stage transitions to the browser: README, personality, knowledge, image, and save. The initial portrait is generated automatically. Approval opens a meeting lobby; joining connects Reactor. Submitted questions appear immediately in the transcript while the answer is prepared. You can stop an answer, leave, and rejoin.

## Connect the models

Set `DEMO_MODE=false`, supply `GEMINI_API_KEY`, and use `GEMINI_IMAGE_MODEL=gemini-nano-banana-2.1` (the default). The image adapter calls Gemini’s `generateContent` API with the repository README and persona to generate an original portrait. Refinements include only the previous character image and accumulated suggestions; no Octocat reference is used. The configured identifier follows Google’s [Nano Banana 2.1 documentation](https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1).

The model roles follow the linked recommendation:

| Role | Default | Configuration |
| --- | --- | --- |
| Persona and quick answers | Gemini Flash (`gemini-3.8-flash`) | `GEMINI_TEXT_MODEL` |
| Deep analysis | Gemini Pro (`gemini-3.1-pro-preview`) | `GEMINI_PRO_MODEL` |
| Repository retrieval | Google embeddings (`gemini-embedding-001`) | `GEMINI_EMBEDDING_MODEL` |
| Read-aloud voice | Gemini Flash TTS (`gemini-3.8-flash-tts`) | `GEMINI_TTS_MODEL` |
| Avatar images | Nano Banana 2.1 | `GEMINI_IMAGE_MODEL` |
| Animated avatar | Reactor LTX (`reactor/ltx2`) | `REACTOR_API_KEY` |

Model identifiers are configurable and checked against the [Google model catalog](https://ai.google.dev/gemini-api/docs/models). Gemini Pro is an explicit Deep analysis option and uses the same repository evidence boundary as quick answers. An optional server-side `GITHUB_TOKEN` increases GitHub limits. The starter is intended for public repositories; do not configure a private-repository token for an anonymous public deployment.

Reactor uses the documented LTX model (`reactor/ltx2`) via its typed SDK. Set `REACTOR_API_KEY`, confirm a character, and click “Join video meeting.” The server mints a short-lived, model-scoped token; the browser uploads the approved image and streams video and voice together. Gemini produces a cited answer first; LTX speaks that exact script with persona-directed tone and pace. This keeps the repository knowledge in the grounded answer service. See [docs/providers.md](docs/providers.md) for the model choice and limitations.

API keys remain on the server and belong in ignored `.env.local`, never in client code or Git. Only a scoped Reactor session token reaches the browser.

Each project keeps its own README embedding index. Questions retrieve four excerpts for quick answers or six for deep analysis, then Gemini answers from those excerpts. Existing projects get an index when first asked a question. Embeddings stay server-side and queries use the model recorded at indexing time.

Enable “Read answers aloud” without activating the live avatar to use Gemini TTS. It reads the answer verbatim with the persona's stock voice and delivery style. LTX generates its own synchronized voice/video and has no documented external-audio input. These are separate playback paths; Gemini TTS does not drive LTX lip synchronization.

## Repository structure

```text
src/
  app/
    page.tsx                    # Search page / avatar studio
    globals.css                 # Responsive visual design
    api/
      reference/                # Legacy asset endpoint; unused by the studio
      projects/                 # README import + persona creation
        [id]/                   # Restore a browser-owned project
          actions/              # Generate, approve, chat, activate
  components/studio.tsx          # Search, persona, versions, chat, speech
    reactor-avatar.tsx          # LTX meeting video/audio, lifecycle, persona delivery
    microphone-question.tsx    # Opt-in voice recording and transcription
  domain/schemas.ts             # Shared types + provider output validation
  server/
    github.ts                   # Strict GitHub URL parsing + README ingestion
    persona.ts                  # Gemini persona orchestration
    persona-markdown.ts         # Exportable PERSONA.md
    chat.ts                     # README-grounded answers with line citations
    knowledge.ts                # Per-project chunks, embeddings, retrieval
    models.ts                   # Configurable Google model roles
    store.ts                    # Browser-owned local JSON projects
    http.ts                     # Session cookie, input and origin handling
    providers/
      gemini.ts                 # Gemini REST transport
      image.ts                  # Original character generation and refinement
      reactor.ts                # Scoped Reactor token exchange
      embeddings.ts             # Google retrieval vectors
      transcription.ts          # Google speech-to-text for microphone questions
      speech.ts                 # Gemini TTS + stable stock voice
tests/                          # Core behavior tests
docs/                           # Architecture and provider contracts
red-polo.png                    # Legacy asset, preserved; not used for generation
```

## Checks

Local repository import diagnostics are printed in the development terminal and
saved to ignored `.data/logs/imports.jsonl`. Each entry includes a request ID,
normalized repository URL, stage (README, persona, embeddings, avatar, or save), outcome,
and elapsed time. Credentials, session cookies, prompts, and README content are
not logged. These diagnostics track requests and failures, not provider billing.

```bash
npm test
npm run typecheck
npm run build
```

## Starter boundaries

Projects and avatar versions persist under ignored `.data/projects`, scoped to a seven-day HTTP-only browser session cookie. The browser remembers the latest project ID. Clearing cookies loses access to those projects. Storage is designed for a single local instance; it has no database, concurrent-write coordination, cleanup jobs, authentication, quotas, or billing controls. Add those before a public deployment. This application imports only the README, up to 60,000 characters; it does not claim knowledge of source files, issues, or history.

Persona traits, backstory, and visuals are fictional interpretations. Answers prioritize retrieved README evidence and display cited excerpts. Citation line bounds and membership in retrieved excerpts are checked, but factual support still depends on model behavior. Gemini TTS uses a stable stock voice and persona delivery metadata. Browser speech is only for the explicit demo; live speech failures remain visible and do not silently switch providers. LTX supplies its own generated voice and lip-synced video. Character animation quality needs live evaluation: Reactor documents portrait inputs, so stylized character fidelity is not guaranteed. Microphone questions use browser MediaRecorder and Gemini transcription. Press “Ask by voice”, record up to one minute, then “Finish question” to send it. Audio is sent only after finishing; permission denial leaves typed questions available. Your camera is not requested.

Use the supplied Octocat asset in accordance with its applicable GitHub permissions and branding guidelines; this project does not grant rights to it.
