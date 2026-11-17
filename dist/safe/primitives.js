import { attempt } from "../result.js";
import { describeCause, taggedError } from "../error.js";
export function safeBigInt(value) {
    return attempt(() => BigInt(value), (cause) => taggedError("BigIntError", `cannot convert to bigint: ${describeCause(cause)}`, cause));
}
export function safeStructuredClone(value) {
    return attempt(() => structuredClone(value), (cause) => taggedError("CloneError", `cannot clone value: ${describeCause(cause)}`, cause));
}
export function safeAtob(data) {
    return attempt(() => atob(data), (cause) => taggedError("Base64Error", `invalid base64: ${describeCause(cause)}`, cause));
}
export function safeBtoa(data) {
    return attempt(() => btoa(data), (cause) => taggedError("Base64Error", `cannot base64-encode: ${describeCause(cause)}`, cause));
}
export function safeRegExp(pattern, flags) {
    return attempt(() => new RegExp(pattern, flags), (cause) => taggedError("RegExpError", `invalid regular expression: ${describeCause(cause)}`, cause));
}
//# sourceMappingURL=primitives.js.map