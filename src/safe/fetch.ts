import { attemptAsync, err, ok, type AsyncResult, type Result } from "../result.ts";
import { describeCause, taggedError, type TaggedError } from "../error.ts";
import { safeJsonParse, type JsonParseError } from "./json.ts";
import { parseWith, type InferOutput, type SchemaError, type StandardSchemaV1 } from "./schema.ts";

export type FetchError =
  | TaggedError<"FetchTimeout">
  | TaggedError<"FetchAborted">
  | TaggedError<"FetchNetworkError">
  | TaggedError<"FetchInvalidOptions">;

export type BodyError = TaggedError<"BodyTooLarge"> | TaggedError<"BodyReadError">;

export interface HttpStatusError extends TaggedError<"HttpStatusError"> {
  readonly status: number;
}

export type FetchJsonError = FetchError | HttpStatusError | BodyError | JsonParseError | SchemaError;

export interface SafeFetchInit extends Omit<RequestInit, "signal"> {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal | undefined;
}

export interface BodyLimits {
  readonly maxBytes?: number | undefined;
}

export interface FetchJsonInit extends SafeFetchInit, BodyLimits {
  readonly maxDepth?: number | undefined;
}

export const DEFAULT_MAX_BODY_BYTES = 10_000_000;

export async function safeFetch(input: string | URL | Request, init: SafeFetchInit): AsyncResult<Response, FetchError> {
  const { timeoutMs, signal: callerSignal, ...requestInit } = init;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return err(taggedError("FetchInvalidOptions", `timeoutMs must be a positive number, got ${String(timeoutMs)}`));
  }
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal === undefined ? timeout : AbortSignal.any([timeout, callerSignal]);
  return attemptAsync(
    () => fetch(input, { ...requestInit, signal }),
    (cause): FetchError => {
      if (timeout.aborted) {
        return taggedError("FetchTimeout", `request timed out after ${String(timeoutMs)} ms`, cause);
      }
      if (callerSignal?.aborted === true) {
        return taggedError("FetchAborted", "request was aborted", cause);
      }
      return taggedError("FetchNetworkError", describeCause(cause), cause);
    },
  );
}

function discardBody(response: Response): void {
  response.body?.cancel().catch(() => undefined);
}

async function readLimited(response: Response, maxBytes: number): AsyncResult<string, BodyError> {
  if (response.body === null) {
    return ok("");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  let chunk = await reader.read();
  while (!chunk.done) {
    const bytes: unknown = chunk.value;
    if (!(bytes instanceof Uint8Array)) {
      reader.cancel().catch(() => undefined);
      return err(taggedError("BodyReadError", "response body produced a non-byte chunk"));
    }
    received += bytes.byteLength;
    if (received > maxBytes) {
      reader.cancel().catch(() => undefined);
      return err(taggedError("BodyTooLarge", `response body exceeds ${String(maxBytes)} bytes`));
    }
    text += decoder.decode(bytes, { stream: true });
    chunk = await reader.read();
  }
  return ok(text + decoder.decode());
}

export async function readBody(response: Response, limits: BodyLimits = {}): AsyncResult<string, BodyError> {
  const maxBytes = limits.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    discardBody(response);
    return err(taggedError("BodyTooLarge", `Content-Length ${String(declared)} exceeds ${String(maxBytes)} bytes`));
  }
  const read = await attemptAsync(
    () => readLimited(response, maxBytes),
    (cause): BodyError => taggedError("BodyReadError", `failed to read body: ${describeCause(cause)}`, cause),
  );
  return read.ok ? read.value : read;
}

export async function fetchJson<S extends StandardSchemaV1>(
  input: string | URL | Request,
  schema: S,
  init: FetchJsonInit,
): AsyncResult<InferOutput<S>, FetchJsonError> {
  const { maxBytes, maxDepth, ...fetchInit } = init;
  const fetched = await safeFetch(input, fetchInit);
  if (!fetched.ok) {
    return fetched;
  }
  const response = fetched.value;
  if (!response.ok) {
    discardBody(response);
    const status: HttpStatusError = {
      ...taggedError("HttpStatusError", `HTTP ${String(response.status)} ${response.statusText}`.trim()),
      status: response.status,
    };
    return err(status);
  }
  const body = await readBody(response, { maxBytes });
  if (!body.ok) {
    return body;
  }
  const json: Result<unknown, JsonParseError> = safeJsonParse(body.value, {
    maxLength: Number.POSITIVE_INFINITY,
    maxDepth,
  });
  if (!json.ok) {
    return json;
  }
  return parseWith(schema, json.value);
}
