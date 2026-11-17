import { type Result } from "../result.ts";
import { type TaggedError } from "../error.ts";
export type JsonParseError = TaggedError<"JsonTooLarge"> | TaggedError<"JsonTooDeep"> | TaggedError<"JsonSyntaxError">;
export type JsonStringifyError = TaggedError<"JsonStringifyError"> | TaggedError<"JsonNotSerializable">;
export interface JsonLimits {
    readonly maxLength?: number | undefined;
    readonly maxDepth?: number | undefined;
}
export declare const DEFAULT_JSON_MAX_LENGTH = 1000000;
export declare const DEFAULT_JSON_MAX_DEPTH = 64;
export declare function jsonNestingDepth(text: string): number;
export declare function safeJsonParse(text: string, limits?: JsonLimits): Result<unknown, JsonParseError>;
export declare function safeJsonStringify(value: unknown, indent?: number): Result<string, JsonStringifyError>;
//# sourceMappingURL=json.d.ts.map