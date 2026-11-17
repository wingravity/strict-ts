import { attempt, type Result } from "../result.ts";
import { describeCause, taggedError, type TaggedError } from "../error.ts";

export type UrlError = TaggedError<"UrlError">;
export type UriCodingError = TaggedError<"UriCodingError">;

export function safeUrl(input: string, base?: string | URL): Result<URL, UrlError> {
  return attempt(
    () => new URL(input, base),
    (cause) => taggedError("UrlError", `invalid URL: ${describeCause(cause)}`, cause),
  );
}

function uriCoder(name: string, fn: (s: string) => string): (s: string) => Result<string, UriCodingError> {
  return (s) =>
    attempt(
      () => fn(s),
      (cause) => taggedError("UriCodingError", `${name} failed: ${describeCause(cause)}`, cause),
    );
}

export const safeDecodeURIComponent = uriCoder("decodeURIComponent", decodeURIComponent);
export const safeEncodeURIComponent = uriCoder("encodeURIComponent", encodeURIComponent);
export const safeDecodeURI = uriCoder("decodeURI", decodeURI);
export const safeEncodeURI = uriCoder("encodeURI", encodeURI);
