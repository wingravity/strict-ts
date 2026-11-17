import { execSync } from "node:child_process"; // @expect @typescript-eslint/no-restricted-imports
import type { ChildProcess } from "node:child_process";

export const run = (): string => execSync("true").toString();
export type Child = ChildProcess;
export { bucket } from "./minio/client.ts";
export { readFile } from "node:fs/promises"; // @expect @typescript-eslint/no-restricted-imports
