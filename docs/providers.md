# Model integrations

## Gemini

Text requests use `generateContent`, server-only `x-goog-api-key`, JSON output, and Zod validation. The default is Gemini Flash (`gemini-3.8-flash`); explicit Deep analysis uses Gemini Pro (`gemini-3.1-pro-preview`). Configuration is centralized in `src/server/models.ts`, with environment overrides for each role. No non-Google reasoning, embedding, image, or read-aloud providers are used.

Source: [current Google model identifiers](https://ai.google.dev/gemini-api/docs/models).

Images use Nano Banana 2.1 (`gemini-nano-banana-2.1`), with text and image output enabled. Initial image requests use the README and persona without a mascot reference. Refinements include the most recent generated character and accumulated appearance suggestions. The UI retains up to 20 versions, supports approval of any version, and clears approval when generating another version. Generated image parts use Gemini’s `inlineData` response structure. Thinking-only images are excluded from final image selection.

Sources: [model identifier](https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1), [image generation and editing](https://ai.google.dev/gemini-api/docs/image-generation).

## Repository knowledge and retrieval

Each project stores its own README chunks and 768-dimensional Google embeddings in its private project record. Chunks target 2,400 characters and preserve original line numbers, including when splitting long lines. Document vectors use `RETRIEVAL_DOCUMENT`; question vectors use `RETRIEVAL_QUERY`. Requests call `batchEmbedContents` with top-level `taskType` and `outputDimensionality` request fields and default to `gemini-embedding-001`. A source hash prevents retrieval from an outdated index.

Queries use the index's recorded model, avoiding mixed vector spaces after configuration changes. Cosine ranking retrieves four excerpts for Flash or six for Pro. Only those excerpts reach the answer model. Citations must lie within a retrieved excerpt as well as the README. Changing the embedding default affects new/rebuilt indexes; reimport to migrate an existing index. The browser never receives vector data.

The corpus currently contains only the README, not code, issues, pull requests, or history. Deeper reasoning cannot create knowledge of files that have not been ingested. Demo mode uses deterministic lexical answers and no embedding API calls.

Source: [Google embeddings REST contract](https://ai.google.dev/api/embeddings).

## Gemini voice

Read-aloud speech uses `gemini-3.8-flash-tts` via `POST /v1beta/interactions`. The answer stays verbatim in the transcript; persona tone, speaking style, language, pace, and pitch are supplied through `speech_metadata.style`. A stock voice name is persisted in the persona; old personas get a deterministic selection from the repository URL. There is no voice cloning.

Unary responses return WAV audio in the last model-output audio block. The server validates the WAV container and returns it for playback with browser audio controls. Autoplay restrictions can require pressing play. Live speech failures are surfaced while preserving the text answer; browser speech is only used in the explicit demo.

Source: [Gemini TTS request, voices, and WAV output](https://ai.google.dev/gemini-api/docs/speech-generation).

## Reactor model choice

**Selected: LTX (`reactor/ltx2`, package `@reactor-models/ltx2`).** Its image + script input and joint voice/video output suit a repository avatar whose factual answers must remain under our control. The application obtains a Gemini answer and citations, then passes the answer as an LTX script. Persona voice tone, language, and speaking style become the delivery prompt; voice rate maps to words per minute.

**Alternative: Vidu S2-Avatar.** It provides built-in conversation over text or microphone with synchronized speech/video and reusable avatars. It fits a future direct-call mode, but its conversational knowledge path would need separate grounding evaluation and controls. LTX provides the more explicit answer pipeline for this starter.

**Google TTS compatibility:** LTX's documented commands accept an image and text script, not external speech audio. Gemini TTS therefore remains the separate read-aloud output. While LTX is active, its native voice/video handles playback and the read-aloud toggle is disabled. An audio-driven Reactor integration must be verified against a supported input contract before combining these paths.

Both models document portrait inputs. Evaluate generated character motion in live sessions. LTX supplies synchronized answer video/audio. Microphone input is transcribed by Gemini Flash, then follows the same grounded-answer pipeline as typed questions. Browser speech recognition is not used. Recordings are limited to one minute and 5 MB; the server validates format, project ownership, and avatar approval before transcription.

Sources: [LTX overview](https://docs.reactor.inc/model-api-reference/ltx/overview), [typed methods](https://www.reactor.inc/models/ltx/api), [Vidu S2-Avatar](https://docs.reactor.inc/model-api-reference/vidu-s2-avatar/overview).

## Authentication and lifecycle

The project action route calls `POST https://api.reactor.inc/tokens` using `Reactor-API-Key`. It requests a 15-minute token scoped to `reactor/ltx2`, one session, and a 10-minute maximum session duration. API keys never reach the browser. The response is sent with no-store cache headers.

The client dynamically imports the typed SDK, connects, uploads the approved image, applies the voice prompt and pace, and receives `main_video` and `main_audio` into one MediaStream on one video element. The combined stream preserves audio/video timing. Controls let the user start playback if browser autoplay is blocked. New answers update the script and start a take. Disconnect, unmount, token expiry, or the local 10-minute cap closes the client session; reconnect requires an explicit user action. Text answers remain visible after rendering errors. Meetings display connection and answering status, with stop-answer and leave controls. Starting microphone recording stops avatar playback to avoid recording the response.

Source: [Reactor authentication and token scoping](https://docs.reactor.inc/authentication).

## Runtime access

Enable outbound access to `api.github.com`, `generativelanguage.googleapis.com`, `api.reactor.inc`, and Reactor’s required WebRTC/asset destinations in the hosting environment. Local credentials are configured in ignored `.env.local`. Import and chat use live Google APIs; verify image generation and Reactor playback on the target device before deployment.
