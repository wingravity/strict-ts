import { type Result } from "../result.ts";
import { type TaggedError } from "../error.ts";
export type UrlError = TaggedError<"UrlError">;
export type UriCodingError = TaggedError<"UriCodingError">;
export declare function safeUrl(input: string, base?: string | URL): Result<URL, UrlError>;
export declare const safeDecodeURIComponent: (s: string) => Result<string, UriCodingError>;
export declare const safeEncodeURIComponent: (s: string) => Result<string, UriCodingError>;
export declare const safeDecodeURI: (s: string) => Result<string, UriCodingError>;
export declare const safeEncodeURI: (s: string) => Result<string, UriCodingError>;
//# sourceMappingURL=url.d.ts.map