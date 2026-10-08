# Voice prompt investigation

Upstream commit `5c2dbf1f976070df9057c46f2de1a16bdeaa5c85` updates only `prompts/nano_banana_prompt.md`. It adds voice and acoustic design requirements. The image adapter extracts only the image, so the accompanying acoustic text did not update the saved persona or Reactor settings.

The live avatar did send `voice.direction` through `setPrompt`, but mixed it with generic tone labels and visual identity instructions. The app also resent that prompt before every answer and set WPM only during connection. Saving a request for slower or faster delivery did not change the model's WPM setting.

Reactor's [LTX prompt guide](https://docs.reactor.inc/model-api-reference/ltx/prompt-guide) explicitly supports casting voice through the scene prompt. It recommends third-person descriptions of register, grain, accent, breath, cadence and dynamics. It warns that vague adjective labels can converge on a generic voice and that resending prompts resets voice. The [API](https://www.reactor.inc/models/ltx/api) supplies separate WPM and seed controls.

## Corrections

- Persona generation reads the acoustic section of the pulled prompt and saves structured casting and WPM settings. Image generation retains the existing non-human requirement.
- Saving a voice direction uses Gemini Flash to expand it into concrete casting prose and interpret pacing within Reactor's 80–220 WPM range. Blank directions clear the derived overrides; demo mode makes no model call.
- The live client sends casting and WPM only when they change. It checks the actual `prompt_accepted.prompt` and `wpm_accepted.wpm` responses before recording settings as applied. The fixed seed remains stable within a meeting.
- Preview voice uses the same script each time, avoiding differences caused by question wording. The UI displays the saved pace; console diagnostics report accepted pace and prompt length without prompts or credentials.
- Gemini read-aloud uses the same casting profile as structured speech metadata. It remains a separate path; its audio does not drive Reactor lip sync.
- Explicit casting replaces older generic delivery labels, avoiding conflicts such as a harsh voice request followed by the persona's old friendly delivery or pitch setting.

Older projects keep their persona. Save their voice direction once to compile casting and pace; new imports receive the acoustic profile automatically. Changes apply on the next preview or answer, not midway through already generated speech.

## Validation limits

Tests verify profile generation, validation, clearing, unchanged-setting caching, command rejection, and transport payloads. Live acknowledgment proves the model accepted casting and pace; it does not guarantee a specific accent, vocal resemblance, or perceived quality. Those need listening comparisons using Preview voice. The model can still vary its delivery.

The live browser comparison confirmed exact prompt echoes and WPM acknowledgments at 95 WPM (slow, gravelly baritone) and 185 WPM (fast, bright soprano) in one meeting, using the same preview script. Replaying the unchanged fast profile did not resend its casting or WPM. The user's original Irish-accent preference was restored after comparison. No subjective claim about accent fidelity is made.
