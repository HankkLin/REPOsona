# Architecture

The Next.js App Router hosts the UI and server routes in one TypeScript application. Route handlers validate input and ownership; server services own repository ingestion, persona generation, avatars, and answers. Provider transports stay behind separate modules so vendor changes do not rewrite the UI.

## Journey

1. User submits an HTTPS GitHub root URL. Parse a strict `owner/name` pair; fetch the README through GitHub’s API using its actual file path and default branch.
2. Gemini Flash infers a structured creative persona and stock voice. Save the README snapshot, persona, and per-project Google embedding index together. Export the persona as markdown.
3. Generate the initial avatar from the persona and existing Octocat PNG. Additional suggestions use the reference, the latest image, and prior suggestions. Retain versions.
4. Approve a version. Retrieve excerpts from this project's index; Gemini Flash or explicitly selected Gemini Pro answers with original README line citations. Optional Gemini TTS reads the answer using the stable stock voice and persona delivery metadata. Browser speech is restricted to the explicit demo.
5. Alternatively activate the live Reactor avatar: mint a scoped token. The LTX client uploads the approved image and sets persona-directed delivery. Each cited Gemini answer becomes the exact speech script; audio/video tracks share one MediaStream.

## Grounding and trust

README content is evidence, never an instruction source. Persona and question content cannot change the grounding rule. Responses have validated structure and valid line bounds, and the UI displays source excerpts as escaped text. The demo fixture is explicitly identified. A creative avatar is never presented as evidence of a repository feature.

Credentials stay in server environment variables. Input URLs cannot select arbitrary fetch hosts. A same-site HTTP-only cookie scopes project access; projects have random UUIDs and are not enumerable through the API. Origin checks protect browser mutations. These are local-starter measures, not a replacement for authenticated users and production abuse controls.

## Provider constraints

Reactor is mandatory for avatar rendering; Google models are required for all other AI tasks, as recorded in `AGENTS.md`. LTX generates its own voice from the exact grounded answer script. It has no documented external-audio input, so Gemini TTS stays a separate playback path. No automatic non-Google or browser-model fallback is used in live mode.

## Next milestones

- Evaluate live Octocat fidelity, Google TTS delivery, and model access with configured credentials.
- Verify an audio-driven Reactor model before attempting Gemini TTS lip synchronization.
- Add user authentication, database storage, object storage, project deletion/retention, rate limiting, cost quotas, and serialized project mutations.
- Use immutable README commit URLs so external citations match the stored snapshot over time.
- Ingest selected docs and code with permission-aware retrieval; add semantic grounding evaluation.
- Add microphone transcription and automatic reconnect with session-bound token refresh. Current sessions support explicit disconnect and bounded duration.
