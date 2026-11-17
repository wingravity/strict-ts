import { type AsyncResult } from "../result.ts";
import { type FsError } from "../node/fs.ts";
export declare const TSCONFIG_ENTRY = "strict-ts/tsconfig.json";
export declare const ESLINT_EXTENSION = "dbaeumer.vscode-eslint";
export declare const CHECK_SCRIPT = "tsc --noEmit && eslint .";
export interface InitOptions {
    readonly cwd: string;
    readonly packageSpec: string;
    readonly dryRun?: boolean | undefined;
    readonly force?: boolean | undefined;
}
export type ChangeStatus = "created" | "updated" | "unchanged" | "skipped";
export interface Change {
    readonly file: string;
    readonly status: ChangeStatus;
    readonly detail: string;
    readonly content?: string | undefined;
}
export interface InitReport {
    readonly changes: readonly Change[];
    readonly missingPeers: readonly string[];
    readonly packageManager: string;
    readonly notes: readonly string[];
}
export declare function planInit(options: InitOptions): AsyncResult<InitReport, string>;
export declare function applyInit(cwd: string, report: InitReport): AsyncResult<void, FsError>;
export declare function installCommand(packageManager: string, peers: readonly string[]): string;
//# sourceMappingURL=init.d.ts.map