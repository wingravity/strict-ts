import { setTimeout as sleep } from "node:timers/promises";
import { attemptAsync } from "../result.js";
export const DEFAULT_GUARD_TIMEOUT_MS = 5_000;
export function installProcessGuards(options) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_GUARD_TIMEOUT_MS;
    const signals = options.signals ?? ["SIGTERM", "SIGINT"];
    const exit = options.exit ?? ((code) => process.exit(code));
    let exiting = false;
    const runHook = async (hook, fn) => {
        const outcome = await Promise.race([
            attemptAsync(fn, (error) => error),
            sleep(timeoutMs, "timeout", { ref: false }),
        ]);
        if (outcome === "timeout") {
            options.log({ kind: "hookTimedOut", hook, timeoutMs });
            return false;
        }
        if (!outcome.ok) {
            options.log({ kind: "hookFailed", hook, error: outcome.error });
            return false;
        }
        return true;
    };
    const shutdown = async (code, hook, fn) => {
        if (exiting) {
            return;
        }
        exiting = true;
        const succeeded = fn === undefined ? true : await runHook(hook, fn);
        exit(succeeded ? code : 1);
    };
    const onUncaughtException = (error) => {
        options.log({ kind: "uncaughtException", error });
        void shutdown(1, "onFatal", options.onFatal);
    };
    const onUnhandledRejection = (error) => {
        options.log({ kind: "unhandledRejection", error });
        void shutdown(1, "onFatal", options.onFatal);
    };
    const onSignal = (signal) => {
        options.log({ kind: "shutdown", signal });
        const hook = options.onShutdown;
        void shutdown(0, "onShutdown", hook === undefined ? undefined : () => hook(signal));
    };
    process.on("uncaughtException", onUncaughtException);
    process.on("unhandledRejection", onUnhandledRejection);
    for (const signal of signals) {
        process.on(signal, onSignal);
    }
    return () => {
        process.off("uncaughtException", onUncaughtException);
        process.off("unhandledRejection", onUnhandledRejection);
        for (const signal of signals) {
            process.off(signal, onSignal);
        }
    };
}
//# sourceMappingURL=process.js.map