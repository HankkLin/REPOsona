import { afterEach, expect, it, vi } from "vitest";
import { meetingStep } from "@/components/meeting-step";

afterEach(() => vi.useRealTimers());

it("ends a stalled startup with the failing stage and retry guidance", async () => {
  vi.useFakeTimers();
  const result = meetingStep("Connect to Reactor", () => new Promise(() => {}), 60000);
  const check = expect(result).rejects.toThrow("Connect to Reactor timed out. Leave and rejoin");
  await vi.advanceTimersByTimeAsync(60000);
  await check;
  expect(vi.getTimerCount()).toBe(0);
});

it("returns successful results and clears its timeout", async () => {
  vi.useFakeTimers();
  expect(await meetingStep("Upload avatar image", async () => "file")).toBe("file");
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves SDK failures and clears its timeout", async () => {
  vi.useFakeTimers();
  await expect(meetingStep("Connect to Reactor", async () => { throw new Error("Unauthorized"); })).rejects.toThrow("Unauthorized");
  expect(vi.getTimerCount()).toBe(0);
});
