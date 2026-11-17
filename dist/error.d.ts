export interface TaggedError<K extends string> {
    readonly kind: K;
    readonly message: string;
    readonly cause?: unknown;
}
export declare function taggedError<K extends string>(kind: K, message: string, cause?: unknown): TaggedError<K>;
export declare function describeCause(cause: unknown): string;
//# sourceMappingURL=error.d.ts.map