import { expect, it, vi } from "vitest";
import { startMeetingWelcome } from "@/components/meeting-welcome";

function client() {
  return {
    setSeed: vi.fn().mockResolvedValue({ type: "seed_accepted" }),
    setScript: vi.fn().mockResolvedValue({ type: "script_accepted" }),
    start: vi.fn().mockResolvedValue(undefined),
  };
}

it("starts a speaking welcome immediately with accepted script and stable voice", async () => {
  const first = client(); const second = client();
  await startMeetingWelcome(first, "Pico");
  await startMeetingWelcome(second, "Pico");
  expect(first.setScript).toHaveBeenCalledWith({ script: expect.stringContaining("Hi, I’m Pico.") });
  expect(first.start).toHaveBeenCalledOnce();
  expect(first.setScript.mock.invocationCallOrder[0]).toBeLessThan(first.start.mock.invocationCallOrder[0]);
  expect(first.setSeed.mock.calls[0]).toEqual(second.setSeed.mock.calls[0]);
});

it("never starts generation when Reactor rejects the script", async () => {
  const model = client(); model.setScript.mockResolvedValue(undefined);
  await expect(startMeetingWelcome(model, "Pico")).rejects.toThrow("welcome script");
  expect(model.start).not.toHaveBeenCalled();
});

it("does not proceed after a rejected voice command or failed start", async () => {
  const model = client(); model.setSeed.mockResolvedValue(undefined);
  await expect(startMeetingWelcome(model, "Pico")).rejects.toThrow("voice seed");
  expect(model.setScript).not.toHaveBeenCalled();
  const failed = client(); failed.start.mockRejectedValue(new Error("Session unavailable"));
  await expect(startMeetingWelcome(failed, "Pico")).rejects.toThrow("Session unavailable");
});
