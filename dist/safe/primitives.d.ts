import { type Result } from "../result.ts";
import { type TaggedError } from "../error.ts";
export type BigIntError = TaggedError<"BigIntError">;
export type CloneError = TaggedError<"CloneError">;
export type Base64Error = TaggedError<"Base64Error">;
export type RegExpError = TaggedError<"RegExpError">;
export declare function safeBigInt(value: string | number | boolean | bigint): Result<bigint, BigIntError>;
export declare function safeStructuredClone<T>(value: T): Result<T, CloneError>;
export declare function safeAtob(data: string): Result<string, Base64Error>;
export declare function safeBtoa(data: string): Result<string, Base64Error>;
export declare function safeRegExp(pattern: string, flags?: string): Result<RegExp, RegExpError>;
//# sourceMappingURL=primitives.d.ts.map