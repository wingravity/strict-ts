import { execSync } from "node:child_process";
import { attempt, type Result } from "strict-ts";

export function runCommand(command: string): Result<string, string> {
  return attempt(
    () => execSync(command).toString(),
    (cause) => String(cause),
  );
}

export function parseLegacy(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    return e.message; // @expect TS18046
  }
}

export async function drain(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<number> {
  let total = 0;
  let chunk = await reader.read();
  while (!chunk.done) {
    total += chunk.value.byteLength;
    chunk = await reader.read();
  }
  return total;
}

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const badDelay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)); // @expect no-promise-executor-return
