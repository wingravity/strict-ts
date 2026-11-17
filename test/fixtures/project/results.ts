import { err, ok, type AsyncResult, type Result } from "strict-ts";

function save(id: number): Result<number, string> {
  return id > 0 ? ok(id) : err("invalid id");
}

function saveAsync(id: number): AsyncResult<number, string> {
  return Promise.resolve(save(id));
}

export function ignored(): void {
  save(1); // @expect strict-ts/must-use-result
}

export async function ignoredAsync(): Promise<void> {
  await saveAsync(1); // @expect strict-ts/must-use-result
}

export function ignoredInCallback(ids: readonly number[]): void {
  ids.forEach((id) => save(id)); // @expect strict-ts/must-use-result
}

export function handled(): number {
  const result = save(1);
  if (!result.ok) {
    return 0;
  }
  return result.value;
}
