import type { Stats } from "node:fs";
import { type AsyncResult } from "../result.ts";
import { type TaggedError } from "../error.ts";
export interface FsError extends TaggedError<"FsError"> {
    readonly code: string;
    readonly path: string;
}
export interface FileTooLargeError extends TaggedError<"FileTooLarge"> {
    readonly path: string;
    readonly size: number;
}
export interface FileLimits {
    readonly maxBytes?: number | undefined;
}
export declare const DEFAULT_MAX_FILE_BYTES = 10000000;
export declare function stat(path: string): AsyncResult<Stats, FsError>;
export declare function readDir(path: string): AsyncResult<string[], FsError>;
export declare function readTextFile(path: string, limits?: FileLimits): AsyncResult<string, FsError | FileTooLargeError>;
export declare function writeTextFile(path: string, content: string): AsyncResult<void, FsError>;
export declare function ensureDir(path: string): AsyncResult<void, FsError>;
//# sourceMappingURL=fs.d.ts.map