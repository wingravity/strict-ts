import { ESLint } from "eslint";
import { type AsyncResult } from "../../result.ts";
import { type Priority } from "./classify.ts";
export interface Finding {
    readonly source: "typescript" | "eslint";
    readonly rule: string;
    readonly file: string;
    readonly line: number;
    readonly column: number;
    readonly message: string;
    readonly test: boolean;
    readonly priority: Priority;
    readonly why: string;
    readonly fix: string;
}
export interface ConfigChange {
    readonly setting: string;
    readonly expected: string;
    readonly actual: string;
}
export interface Report {
    readonly generatedAt: string;
    readonly project: string;
    readonly findings: readonly Finding[];
    readonly configChanges: readonly ConfigChange[];
}
export interface ReportOptions {
    readonly cwd: string;
    readonly tsconfig?: string | undefined;
    readonly respectSuppressions?: boolean | undefined;
    readonly eslintOptions?: ESLint.Options | undefined;
}
export declare function isTestFile(file: string): boolean;
export declare function expectedRuleSeverities(): Map<string, number>;
export declare function buildReport(options: ReportOptions): AsyncResult<Report, string>;
//# sourceMappingURL=collect.d.ts.map