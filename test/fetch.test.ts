import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fetchJson, readBody, safeFetch, type StandardSchemaV1 } from "../src/safe/index.ts";

let server: Server;
let base = "";

before(async () => {
  server = createServer((req, res) => {
    switch (req.url) {
      case "/json":
        res.setHeader("content-type", "application/json");
        res.end('{"id":7}');
        return;
      case "/bad-json":
        res.end("{nope");
        return;
      case "/wrong-shape":
        res.end('{"id":"seven"}');
        return;
      case "/deep":
        res.end("[".repeat(100) + "]".repeat(100));
        return;
      case "/status":
        res.statusCode = 503;
        res.end("down");
        return;
      case "/slow":
        setTimeout(() => res.end("late"), 2_000).unref();
        return;
      case "/big-declared":
        res.setHeader("content-length", "1000");
        res.end("x".repeat(1000));
        return;
      case "/big-chunked":
        res.write("x".repeat(600));
        res.end("x".repeat(600));
        return;
      default:
        res.statusCode = 404;
        res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${String(port)}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const idSchema: StandardSchemaV1<unknown, { id: number }> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) =>
      typeof value === "object" && value !== null && "id" in value && typeof value.id === "number"
        ? { value: { id: value.id } }
        : { issues: [{ message: "expected { id: number }" }] },
  },
};

function kindOf(r: { ok: true } | { ok: false; error: { kind: string } }): string {
  return r.ok ? "ok" : r.error.kind;
}

describe("safeFetch", () => {
  it("returns the response, including non-2xx statuses", async () => {
    const r = await safeFetch(`${base}/status`, { timeoutMs: 1_000 });
    assert.ok(r.ok && r.value.status === 503);
    await r.value.body?.cancel();
  });

  it("times out", async () => {
    const r = await safeFetch(`${base}/slow`, { timeoutMs: 50 });
    assert.equal(kindOf(r), "FetchTimeout");
  });

  it("distinguishes caller aborts from timeouts", async () => {
    const r = await safeFetch(`${base}/slow`, { timeoutMs: 1_000, signal: AbortSignal.abort() });
    assert.equal(kindOf(r), "FetchAborted");
  });

  it("reports network errors", async () => {
    const r = await safeFetch("http://127.0.0.1:1/", { timeoutMs: 1_000 });
    assert.equal(kindOf(r), "FetchNetworkError");
  });

  it("reports invalid URLs as network errors instead of throwing", async () => {
    assert.equal(kindOf(await safeFetch("not a url", { timeoutMs: 1_000 })), "FetchNetworkError");
  });

  it("rejects a missing or invalid timeout", async () => {
    assert.equal(kindOf(await safeFetch(`${base}/json`, { timeoutMs: 0 })), "FetchInvalidOptions");
    assert.equal(kindOf(await safeFetch(`${base}/json`, { timeoutMs: Number.NaN })), "FetchInvalidOptions");
  });
});

describe("readBody", () => {
  it("reads text", async () => {
    const r = await safeFetch(`${base}/json`, { timeoutMs: 1_000 });
    assert.ok(r.ok);
    assert.deepEqual(await readBody(r.value), { ok: true, value: '{"id":7}' });
  });

  it("rejects a declared Content-Length over the limit without reading", async () => {
    const r = await safeFetch(`${base}/big-declared`, { timeoutMs: 1_000 });
    assert.ok(r.ok);
    assert.equal(kindOf(await readBody(r.value, { maxBytes: 500 })), "BodyTooLarge");
  });

  it("stops a streamed body once it passes the limit", async () => {
    const r = await safeFetch(`${base}/big-chunked`, { timeoutMs: 1_000 });
    assert.ok(r.ok);
    assert.equal(kindOf(await readBody(r.value, { maxBytes: 1_000 })), "BodyTooLarge");
  });

  it("returns an error when the body was already used", async () => {
    const r = await safeFetch(`${base}/json`, { timeoutMs: 1_000 });
    assert.ok(r.ok);
    await readBody(r.value);
    assert.equal(kindOf(await readBody(r.value)), "BodyReadError");
  });
});

describe("fetchJson", () => {
  it("fetches, parses and validates", async () => {
    assert.deepEqual(await fetchJson(`${base}/json`, idSchema, { timeoutMs: 1_000 }), { ok: true, value: { id: 7 } });
  });

  it("returns HttpStatusError with the status", async () => {
    const r = await fetchJson(`${base}/status`, idSchema, { timeoutMs: 1_000 });
    assert.ok(!r.ok && r.error.kind === "HttpStatusError");
    assert.equal(r.error.status, 503);
  });

  it("returns each failure as its own kind", async () => {
    const opts = { timeoutMs: 1_000 };
    assert.equal(kindOf(await fetchJson(`${base}/bad-json`, idSchema, opts)), "JsonSyntaxError");
    assert.equal(kindOf(await fetchJson(`${base}/wrong-shape`, idSchema, opts)), "SchemaValidationError");
    assert.equal(kindOf(await fetchJson(`${base}/deep`, idSchema, { ...opts, maxDepth: 10 })), "JsonTooDeep");
    assert.equal(kindOf(await fetchJson(`${base}/big-declared`, idSchema, { ...opts, maxBytes: 10 })), "BodyTooLarge");
    assert.equal(kindOf(await fetchJson(`${base}/slow`, idSchema, { timeoutMs: 50 })), "FetchTimeout");
  });
});
