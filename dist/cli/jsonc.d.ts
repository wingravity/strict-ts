import { type Result } from "../result.ts";
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function asArray(value: unknown): readonly unknown[];
export declare function parseJsonc(fileName: string, text: string): Result<Record<string, unknown>, string>;
export declare function detectIndent(text: string): string;
export declare function setTopLevelProperty(fileName: string, text: string, key: string, value: unknown): Result<string, string>;
//# sourceMappingURL=jsonc.d.ts.map