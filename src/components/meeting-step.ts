// Bound SDK waits even when the transport does not reject a stalled request.
export async function meetingStep<T>(label: string, task: () => Promise<T>, timeoutMs = 30000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out. Leave and rejoin the meeting to retry.`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
