export type Priority = 0 | 1 | 2 | 3 | 4;
export declare const PRIORITY_TITLES: Readonly<Record<Priority, string>>;
export declare const PRIORITY_DESCRIPTIONS: Readonly<Record<Priority, string>>;
export interface Classification {
    readonly priority: Priority;
    readonly why: string;
    readonly fix: string;
}
export declare const UNPARSED_FILE: Classification;
export declare const INERT_INLINE_DISABLE: Classification;
export declare function classifyTypeScript(code: number): Classification;
export declare function classifyEslint(ruleId: string, message: string): Classification;
export declare function isClassifiedRule(ruleId: string): boolean;
//# sourceMappingURL=classify.d.ts.map