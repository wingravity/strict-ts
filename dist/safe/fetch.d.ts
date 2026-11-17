import { type AsyncResult } from "../result.ts";
import { type TaggedError } from "../error.ts";
import { type JsonParseError } from "./json.ts";
import { type InferOutput, type SchemaError, type StandardSchemaV1 } from "./schema.ts";
export type FetchError = TaggedError<"FetchTimeout"> | TaggedError<"FetchAborted"> | TaggedError<"FetchNetworkError"> | TaggedError<"FetchInvalidOptions">;
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
export declare const DEFAULT_MAX_BODY_BYTES = 10000000;
export declare function safeFetch(input: string | URL | Request, init: SafeFetchInit): AsyncResult<Response, FetchError>;
export declare function readBody(response: Response, limits?: BodyLimits): AsyncResult<string, BodyError>;
export declare function fetchJson<S extends StandardSchemaV1>(input: string | URL | Request, schema: S, init: FetchJsonInit): AsyncResult<InferOutput<S>, FetchJsonError>;
//# sourceMappingURL=fetch.d.ts.map