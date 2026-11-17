import { mkdir, readdir, readFile, stat as statPath, writeFile } from "node:fs/promises";
import { attemptAsync, err } from "../result.js";
import { describeCause } from "../error.js";
export const DEFAULT_MAX_FILE_BYTES = 10_000_000;
function errorCode(cause) {
    return cause instanceof Error && "code" in cause && typeof cause.code === "string" ? cause.code : "UNKNOWN";
}
function toFsError(path) {
    return (cause) => ({ kind: "FsError", code: errorCode(cause), path, message: describeCause(cause), cause });
}
export function stat(path) {
    return attemptAsync(() => statPath(path), toFsError(path));
}
export function readDir(path) {
    return attemptAsync(() => readdir(path), toFsError(path));
}
export async function readTextFile(path, limits = {}) {
    const maxBytes = limits.maxBytes ?? DEFAULT_MAX_FILE_BYTES;
    const info = await stat(path);
    if (!info.ok) {
        return info;
    }
    if (info.value.size > maxBytes) {
        return err({
            kind: "FileTooLarge",
            path,
            size: info.value.size,
            message: `${path} is ${String(info.value.size)} bytes, limit is ${String(maxBytes)}`,
        });
    }
    return attemptAsync(() => readFile(path, "utf8"), toFsError(path));
}
export function writeTextFile(path, content) {
    return attemptAsync(() => writeFile(path, content, "utf8"), toFsError(path));
}
export function ensureDir(path) {
    return attemptAsync(async () => {
        await mkdir(path, { recursive: true });
    }, toFsError(path));
}
//# sourceMappingURL=fs.js.map