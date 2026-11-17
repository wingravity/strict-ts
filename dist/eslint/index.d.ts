import type { FlatConfig } from "typescript-eslint";
export interface StrictTsOptions {
    readonly files?: readonly string[] | undefined;
    readonly boundary?: readonly string[] | undefined;
    readonly tests?: readonly string[] | undefined;
    readonly throwingModules?: readonly string[] | undefined;
    readonly allowInlineDisable?: boolean | undefined;
    readonly tsconfigRootDir?: string | undefined;
}
export declare const DEFAULT_FILES: string[];
export declare const DEFAULT_BOUNDARY: string[];
export declare const DEFAULT_TESTS: string[];
export declare function strictTs(options?: StrictTsOptions): FlatConfig.Config[];
export default strictTs;
//# sourceMappingURL=index.d.ts.map