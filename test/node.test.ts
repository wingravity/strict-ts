import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readDir, readTextFile, stat, writeTextFile } from "../src/node/index.ts";

let dir = "";

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "strict-ts-"));
  await writeFile(join(dir, "hello.txt"), "hello");
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("fs wrappers", () => {
  it("reads and writes text files", async () => {
    const path = join(dir, "out.txt");
    assert.deepEqual(await writeTextFile(path, "written"), { ok: true, value: undefined });
    assert.deepEqual(await readTextFile(path), { ok: true, value: "written" });
  });

  it("returns FsError with the code and path for a missing file", async () => {
    const path = join(dir, "missing.txt");
    const r = await readTextFile(path);
    assert.ok(!r.ok && r.error.kind === "FsError");
    assert.equal(r.error.code, "ENOENT");
    assert.equal(r.error.path, path);
  });

  it("refuses files over maxBytes without reading them", async () => {
    const r = await readTextFile(join(dir, "hello.txt"), { maxBytes: 3 });
    assert.ok(!r.ok && r.error.kind === "FileTooLarge");
    assert.equal(r.error.size, 5);
  });

  it("lists directories and stats files", async () => {
    const list = await readDir(dir);
    assert.ok(list.ok && list.value.includes("hello.txt"));
    const info = await stat(join(dir, "hello.txt"));
    assert.ok(info.ok && info.value.size === 5);
    const missing = await readDir(join(dir, "nope"));
    assert.ok(!missing.ok && missing.error.code === "ENOENT");
  });

  it("reports writes into missing directories", async () => {
    const r = await writeTextFile(join(dir, "nope", "x.txt"), "x");
    assert.ok(!r.ok && r.error.code === "ENOENT");
  });
});

const guardModule = resolve(import.meta.dirname, "../src/node/process.ts");

interface ChildOutcome {
  readonly code: number | null;
  readonly events: string[];
}

function runGuarded(body: string, options = "{}"): Promise<ChildOutcome> {
  const script = `
    import { installProcessGuards } from ${JSON.stringify(guardModule)};
    const opts = ${options};
    installProcessGuards({ log: (e) => console.log("event:" + e.kind + (e.hook ? ":" + e.hook : "")), ...opts });
    ${body}
  `;
  return new Promise((done) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on("exit", (code) => {
      done({ code, events: stdout.split("\n").filter((line) => line.startsWith("event:") || line.startsWith("hook:")) });
    });
  });
}

describe("installProcessGuards", () => {
  it("logs an uncaught exception and exits 1", async () => {
    const r = await runGuarded(`setTimeout(() => { throw new Error("boom"); }, 0);`);
    assert.equal(r.code, 1);
    assert.deepEqual(r.events, ["event:uncaughtException"]);
  });

  it("logs an unhandled rejection and exits 1", async () => {
    const r = await runGuarded(`Promise.reject(new Error("nope"));`);
    assert.equal(r.code, 1);
    assert.deepEqual(r.events, ["event:unhandledRejection"]);
  });

  it("awaits onFatal before exiting", async () => {
    const r = await runGuarded(
      `setTimeout(() => { throw new Error("boom"); }, 0);`,
      `{ onFatal: () => new Promise((r) => setTimeout(() => { console.log("hook:flushed"); r(); }, 50)) }`,
    );
    assert.equal(r.code, 1);
    assert.deepEqual(r.events, ["event:uncaughtException", "hook:flushed"]);
  });

  it("handles only the first fatal event", async () => {
    const r = await runGuarded(
      `setTimeout(() => { throw new Error("one"); }, 0); setTimeout(() => { throw new Error("two"); }, 5);`,
      `{ onFatal: () => new Promise((r) => setTimeout(r, 100)) }`,
    );
    assert.equal(r.code, 1);
    assert.deepEqual(r.events, ["event:uncaughtException", "event:uncaughtException"]);
  });

  it("shuts down cleanly on SIGTERM after onShutdown", async () => {
    const r = await runGuarded(
      `setInterval(() => {}, 1000); setTimeout(() => process.kill(process.pid, "SIGTERM"), 20);`,
      `{ onShutdown: (signal) => { console.log("hook:closed-" + signal); } }`,
    );
    assert.equal(r.code, 0);
    assert.deepEqual(r.events, ["event:shutdown", "hook:closed-SIGTERM"]);
  });

  it("exits 1 when onShutdown fails", async () => {
    const r = await runGuarded(
      `setInterval(() => {}, 1000); setTimeout(() => process.kill(process.pid, "SIGTERM"), 20);`,
      `{ onShutdown: () => Promise.reject(new Error("close failed")) }`,
    );
    assert.equal(r.code, 1);
    assert.deepEqual(r.events, ["event:shutdown", "event:hookFailed:onShutdown"]);
  });

  it("exits 1 when onShutdown hangs past the timeout", async () => {
    const r = await runGuarded(
      `setInterval(() => {}, 1000); setTimeout(() => process.kill(process.pid, "SIGTERM"), 20);`,
      `{ timeoutMs: 100, onShutdown: () => new Promise(() => {}) }`,
    );
    assert.equal(r.code, 1);
    assert.deepEqual(r.events, ["event:shutdown", "event:hookTimedOut:onShutdown"]);
  });
});
