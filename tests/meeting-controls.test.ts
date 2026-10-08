import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { MeetingTools } from "@/components/meeting-tools";
import { MicrophoneQuestion } from "@/components/microphone-question";
import { VoiceDirection } from "@/components/voice-direction";

it("keeps the voice control visible while connecting, without requesting microphone access", () => {
  const markup = renderToStaticMarkup(createElement(MicrophoneQuestion, {
    projectId: "project", disabled: true, onQuestion: vi.fn(), onError: vi.fn(),
    onStart: vi.fn(), onActivity: vi.fn(),
  }));
  expect(markup).toContain("Ask by voice");
  expect(markup).toContain("disabled");
  expect(markup).toContain('aria-pressed="false"');
  expect(markup).toContain("Your microphone stays off");
});

it("starts camera and screen controls off with no preview streams", () => {
  const markup = renderToStaticMarkup(createElement(MeetingTools, { children: null, disabled: false, onError: vi.fn() }));
  expect(markup).toContain("Camera off");
  expect(markup).toContain("Share screen");
  expect(markup).not.toContain("<video");
});

it("offers a separate natural-language voice field with saved direction", () => {
  const markup = renderToStaticMarkup(createElement(VoiceDirection, { direction: "Warm and curious", disabled: false, demo: false, onSave: vi.fn() }));
  expect(markup).toContain("Voice direction");
  expect(markup).toContain("Warm and curious");
  expect(markup).toContain("Save voice");
  expect(markup).toContain('maxLength="400"');
});
