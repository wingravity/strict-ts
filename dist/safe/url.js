import { attempt } from "../result.js";
import { describeCause, taggedError } from "../error.js";
export function safeUrl(input, base) {
    return attempt(() => new URL(input, base), (cause) => taggedError("UrlError", `invalid URL: ${describeCause(cause)}`, cause));
}
function uriCoder(name, fn) {
    return (s) => attempt(() => fn(s), (cause) => taggedError("UriCodingError", `${name} failed: ${describeCause(cause)}`, cause));
}
export const safeDecodeURIComponent = uriCoder("decodeURIComponent", decodeURIComponent);
export const safeEncodeURIComponent = uriCoder("encodeURIComponent", encodeURIComponent);
export const safeDecodeURI = uriCoder("decodeURI", decodeURI);
export const safeEncodeURI = uriCoder("encodeURI", encodeURI);
//# sourceMappingURL=url.js.map