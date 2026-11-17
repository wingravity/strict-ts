import { setTimeout as sleep } from "node:timers/promises";
import { attemptAsync } from "../result.ts";

export type GuardEvent =
  | { readonly kind: "uncaughtException"; readonly error: unknown }
  | { readonly kind: "unhandledRejection"; readonly error: unknown }
  | { readonly kind: "shutdown"; readonly signal: NodeJS.Signals }
  | { readonly kind: "hookFailed"; readonly hook: "onFatal" | "onShutdown"; readonly error: unknown }
  | { readonly kind: "hookTimedOut"; readonly hook: "onFatal" | "onShutdown"; readonly timeoutMs: number };

export interface ProcessGuardOptions {
  readonly log: (event: GuardEvent) => void;
  readonly onFatal?: (() => unknown) | undefined;
  readonly onShutdown?: ((signal: NodeJS.Signals) => unknown) | undefined;
  readonly timeoutMs?: number | undefined;
  readonly signals?: readonly NodeJS.Signals[] | undefined;
  readonly exit?: ((code: number) => void) | undefined;
}

export const DEFAULT_GUARD_TIMEOUT_MS = 5_000;

export function installProcessGuards(options: ProcessGuardOptions): () => void {
  const timeoutMs = options.timeoutMs ?? DEFAULT_GUARD_TIMEOUT_MS;
  const signals = options.signals ?? ["SIGTERM", "SIGINT"];
  const exit = options.exit ?? ((code: number) => process.exit(code));
  let exiting = false;

  const runHook = async (hook: "onFatal" | "onShutdown", fn: () => unknown): Promise<boolean> => {
    const outcome = await Promise.race([
      attemptAsync(fn, (error) => error),
      sleep(timeoutMs, "timeout" as const, { ref: false }),
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

  const shutdown = async (code: number, hook: "onFatal" | "onShutdown", fn: (() => unknown) | undefined): Promise<void> => {
    if (exiting) {
      return;
    }
    exiting = true;
    const succeeded = fn === undefined ? true : await runHook(hook, fn);
    exit(succeeded ? code : 1);
  };

  const onUncaughtException = (error: unknown): void => {
    options.log({ kind: "uncaughtException", error });
    void shutdown(1, "onFatal", options.onFatal);
  };

  const onUnhandledRejection = (error: unknown): void => {
    options.log({ kind: "unhandledRejection", error });
    void shutdown(1, "onFatal", options.onFatal);
  };

  const onSignal = (signal: NodeJS.Signals): void => {
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
