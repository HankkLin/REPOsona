import type { Ltx2Model } from "@reactor-models/ltx2/core";
import { meetingStep } from "./meeting-step";

// An explicit first take brings the portrait to life without waiting for a question.
export async function startMeetingWelcome(client: Pick<Ltx2Model, "setSeed" | "setScript" | "start">, name: string) {
  const seed = Array.from(name).reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 0);
  const voice = await meetingStep("Set consistent voice", () => client.setSeed({ seed }));
  if (!voice) throw new Error("Reactor did not accept the voice seed.");
  const script = `Hi, I’m ${name}. Welcome! Ask me a question about my repository README. You can use the microphone or type your question.`.slice(0, 10000);
  const accepted = await meetingStep("Prepare welcome", () => client.setScript({ script }));
  if (!accepted) throw new Error("Reactor did not accept the welcome script.");
  await meetingStep("Start live welcome", () => client.start());
  return script;
}
