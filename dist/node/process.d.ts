export type GuardEvent = {
    readonly kind: "uncaughtException";
    readonly error: unknown;
} | {
    readonly kind: "unhandledRejection";
    readonly error: unknown;
} | {
    readonly kind: "shutdown";
    readonly signal: NodeJS.Signals;
} | {
    readonly kind: "hookFailed";
    readonly hook: "onFatal" | "onShutdown";
    readonly error: unknown;
} | {
    readonly kind: "hookTimedOut";
    readonly hook: "onFatal" | "onShutdown";
    readonly timeoutMs: number;
};
export interface ProcessGuardOptions {
    readonly log: (event: GuardEvent) => void;
    readonly onFatal?: (() => unknown) | undefined;
    readonly onShutdown?: ((signal: NodeJS.Signals) => unknown) | undefined;
    readonly timeoutMs?: number | undefined;
    readonly signals?: readonly NodeJS.Signals[] | undefined;
    readonly exit?: ((code: number) => void) | undefined;
}
export declare const DEFAULT_GUARD_TIMEOUT_MS = 5000;
export declare function installProcessGuards(options: ProcessGuardOptions): () => void;
//# sourceMappingURL=process.d.ts.map