import { attemptAsync, err, ok } from "../result.js";
import { describeCause, taggedError } from "../error.js";
import { safeJsonParse } from "./json.js";
import { parseWith } from "./schema.js";
export const DEFAULT_MAX_BODY_BYTES = 10_000_000;
export async function safeFetch(input, init) {
    const { timeoutMs, signal: callerSignal, ...requestInit } = init;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return err(taggedError("FetchInvalidOptions", `timeoutMs must be a positive number, got ${String(timeoutMs)}`));
    }
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = callerSignal === undefined ? timeout : AbortSignal.any([timeout, callerSignal]);
    return attemptAsync(() => fetch(input, { ...requestInit, signal }), (cause) => {
        if (timeout.aborted) {
            return taggedError("FetchTimeout", `request timed out after ${String(timeoutMs)} ms`, cause);
        }
        if (callerSignal?.aborted === true) {
            return taggedError("FetchAborted", "request was aborted", cause);
        }
        return taggedError("FetchNetworkError", describeCause(cause), cause);
    });
}
function discardBody(response) {
    response.body?.cancel().catch(() => undefined);
}
async function readLimited(response, maxBytes) {
    if (response.body === null) {
        return ok("");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let text = "";
    let chunk = await reader.read();
    while (!chunk.done) {
        const bytes = chunk.value;
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
export async function readBody(response, limits = {}) {
    const maxBytes = limits.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
        discardBody(response);
        return err(taggedError("BodyTooLarge", `Content-Length ${String(declared)} exceeds ${String(maxBytes)} bytes`));
    }
    const read = await attemptAsync(() => readLimited(response, maxBytes), (cause) => taggedError("BodyReadError", `failed to read body: ${describeCause(cause)}`, cause));
    return read.ok ? read.value : read;
}
export async function fetchJson(input, schema, init) {
    const { maxBytes, maxDepth, ...fetchInit } = init;
    const fetched = await safeFetch(input, fetchInit);
    if (!fetched.ok) {
        return fetched;
    }
    const response = fetched.value;
    if (!response.ok) {
        discardBody(response);
        const status = {
            ...taggedError("HttpStatusError", `HTTP ${String(response.status)} ${response.statusText}`.trim()),
            status: response.status,
        };
        return err(status);
    }
    const body = await readBody(response, { maxBytes });
    if (!body.ok) {
        return body;
    }
    const json = safeJsonParse(body.value, {
        maxLength: Number.POSITIVE_INFINITY,
        maxDepth,
    });
    if (!json.ok) {
        return json;
    }
    return parseWith(schema, json.value);
}
//# sourceMappingURL=fetch.js.map