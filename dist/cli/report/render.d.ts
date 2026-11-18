import { type Result } from "../../result.ts";
import type { Finding, Report } from "./collect.ts";
export interface Summary {
    readonly production: Readonly<Record<string, number>>;
    readonly tests: Readonly<Record<string, number>>;
    readonly total: number;
}
export declare function summarize(findings: readonly Finding[]): Summary;
export declare function renderMarkdown(report: Report, projectName: string): string;
export declare function renderJson(report: Report, limit?: number): Result<string, string>;
export declare function renderNext(report: Report, limit: number): string;
//# sourceMappingURL=render.d.ts.map