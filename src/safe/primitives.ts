import { attempt, type Result } from "../result.ts";
import { describeCause, taggedError, type TaggedError } from "../error.ts";

export type BigIntError = TaggedError<"BigIntError">;
export type CloneError = TaggedError<"CloneError">;
export type Base64Error = TaggedError<"Base64Error">;
export type RegExpError = TaggedError<"RegExpError">;

export function safeBigInt(value: string | number | boolean | bigint): Result<bigint, BigIntError> {
  return attempt(
    () => BigInt(value),
    (cause) => taggedError("BigIntError", `cannot convert to bigint: ${describeCause(cause)}`, cause),
  );
}

export function safeStructuredClone<T>(value: T): Result<T, CloneError> {
  return attempt(
    () => structuredClone(value),
    (cause) => taggedError("CloneError", `cannot clone value: ${describeCause(cause)}`, cause),
  );
}

export function safeAtob(data: string): Result<string, Base64Error> {
  return attempt(
    () => atob(data),
    (cause) => taggedError("Base64Error", `invalid base64: ${describeCause(cause)}`, cause),
  );
}

export function safeBtoa(data: string): Result<string, Base64Error> {
  return attempt(
    () => btoa(data),
    (cause) => taggedError("Base64Error", `cannot base64-encode: ${describeCause(cause)}`, cause),
  );
}

export function safeRegExp(pattern: string, flags?: string): Result<RegExp, RegExpError> {
  return attempt(
    () => new RegExp(pattern, flags),
    (cause) => taggedError("RegExpError", `invalid regular expression: ${describeCause(cause)}`, cause),
  );
}
