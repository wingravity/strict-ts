import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  all,
  andThen,
  attempt,
  attemptAsync,
  err,
  map,
  mapErr,
  match,
  ok,
  unwrapOr,
  type Result,
} from "../src/index.ts";

const half = (n: number): Result<number, string> => (n % 2 === 0 ? ok(n / 2) : err(`${String(n)} is odd`));

describe("ok / err", () => {
  it("builds plain serializable objects", () => {
    assert.deepEqual(ok(1), { ok: true, value: 1 });
    assert.deepEqual(err("x"), { ok: false, error: "x" });
    assert.deepEqual(ok(), { ok: true, value: undefined });
    assert.deepEqual(JSON.parse(JSON.stringify(ok({ a: 1 }))), { ok: true, value: { a: 1 } });
    assert.deepEqual(structuredClone(err({ kind: "E" })), { ok: false, error: { kind: "E" } });
  });

  it("narrows with an ordinary if", () => {
    const r = half(4);
    if (!r.ok) {
      assert.fail("expected ok");
    }
    const value: number = r.value;
    assert.equal(value, 2);
  });
});

describe("combinators", () => {
  it("map transforms only success", () => {
    assert.deepEqual(map(ok(2), (n) => n + 1), ok(3));
    assert.deepEqual(map(err("e"), (n: number) => n + 1), err("e"));
  });

  it("mapErr transforms only errors", () => {
    assert.deepEqual(mapErr(err("e"), (e) => e.toUpperCase()), err("E"));
    assert.deepEqual(mapErr(ok(1), (e: string) => e.toUpperCase()), ok(1));
  });

  it("andThen chains fallible steps", () => {
    assert.deepEqual(andThen(half(8), half), ok(2));
    assert.deepEqual(andThen(half(6), half), err("3 is odd"));
    assert.deepEqual(andThen(half(3), half), err("3 is odd"));
  });

  it("unwrapOr falls back on error", () => {
    assert.equal(unwrapOr(half(4), 0), 2);
    assert.equal(unwrapOr(half(3), 0), 0);
  });

  it("match handles both cases", () => {
    const show = (r: Result<number, string>): string => match(r, { ok: (v) => `ok ${String(v)}`, err: (e) => `err ${e}` });
    assert.equal(show(half(4)), "ok 2");
    assert.equal(show(half(3)), "err 3 is odd");
  });

  it("all collects values or returns the first error", () => {
    assert.deepEqual(all([half(2), half(4)]), ok([1, 2]));
    assert.deepEqual(all([half(2), half(3), half(5)]), err("3 is odd"));
    assert.deepEqual(all([]), ok([]));
  });
});

describe("attempt", () => {
  it("captures a return value", () => {
    assert.deepEqual(attempt(() => 42, String), ok(42));
  });

  it("captures a throw", () => {
    const r = attempt(
      () => {
        throw new Error("boom");
      },
      (cause) => (cause instanceof Error ? cause.message : "?"),
    );
    assert.deepEqual(r, err("boom"));
  });
});

describe("attemptAsync", () => {
  it("captures a resolved value", async () => {
    assert.deepEqual(await attemptAsync(() => Promise.resolve(1), String), ok(1));
  });

  it("captures a rejection", async () => {
    assert.deepEqual(await attemptAsync(() => Promise.reject(new Error("no")), () => "rejected"), err("rejected"));
  });

  it("captures a synchronous throw before any promise exists", async () => {
    const r = await attemptAsync(
      () => {
        throw new Error("sync");
      },
      () => "caught",
    );
    assert.deepEqual(r, err("caught"));
  });

  it("accepts plain values", async () => {
    assert.deepEqual(await attemptAsync(() => "plain", String), ok("plain"));
  });
});
