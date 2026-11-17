import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  jsonNestingDepth,
  parseWith,
  parseWithAsync,
  safeAtob,
  safeBigInt,
  safeBtoa,
  safeDecodeURI,
  safeDecodeURIComponent,
  safeEncodeURI,
  safeEncodeURIComponent,
  safeJsonParse,
  safeJsonStringify,
  safeRegExp,
  safeStructuredClone,
  safeUrl,
  type StandardSchemaV1,
} from "../src/safe/index.ts";

function kindOf(r: { ok: true } | { ok: false; error: { kind: string } }): string {
  return r.ok ? "ok" : r.error.kind;
}

describe("safeJsonParse", () => {
  it("parses valid JSON to unknown", () => {
    assert.deepEqual(safeJsonParse('{"a":[1,2]}'), { ok: true, value: { a: [1, 2] } });
  });

  it("returns JsonSyntaxError instead of throwing", () => {
    const r = safeJsonParse("{bad");
    assert.equal(kindOf(r), "JsonSyntaxError");
    assert.ok(!r.ok && r.error.cause instanceof SyntaxError);
  });

  it("rejects input over maxLength before parsing", () => {
    assert.equal(kindOf(safeJsonParse('"abcdef"', { maxLength: 5 })), "JsonTooLarge");
  });

  it("rejects nesting over maxDepth before parsing", () => {
    const deep = "[".repeat(10) + "]".repeat(10);
    assert.equal(kindOf(safeJsonParse(deep, { maxDepth: 9 })), "JsonTooDeep");
    assert.equal(kindOf(safeJsonParse(deep, { maxDepth: 10 })), "ok");
  });

  it("enforces the default depth limit", () => {
    const deep = "[".repeat(100_000) + "]".repeat(100_000);
    assert.equal(kindOf(safeJsonParse(deep)), "JsonTooDeep");
  });
});

describe("jsonNestingDepth", () => {
  it("ignores brackets inside strings, including escaped quotes", () => {
    assert.equal(jsonNestingDepth('{"a":"[[[{{{","b":"\\"[[["}'), 1);
    assert.equal(jsonNestingDepth('[{"a":[1]}]'), 3);
    assert.equal(jsonNestingDepth("42"), 0);
  });
});

describe("safeJsonStringify", () => {
  it("stringifies plain values", () => {
    assert.deepEqual(safeJsonStringify({ a: 1 }), { ok: true, value: '{"a":1}' });
    assert.deepEqual(safeJsonStringify([1], 2), { ok: true, value: "[\n  1\n]" });
  });

  it("returns an error for BigInt and cycles", () => {
    assert.equal(kindOf(safeJsonStringify({ n: 1n })), "JsonStringifyError");
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    assert.equal(kindOf(safeJsonStringify(cyclic)), "JsonStringifyError");
  });

  it("reports values with no JSON representation", () => {
    assert.equal(kindOf(safeJsonStringify(undefined)), "JsonNotSerializable");
    assert.equal(kindOf(safeJsonStringify(() => 1)), "JsonNotSerializable");
  });
});

describe("URL and URI", () => {
  it("safeUrl parses valid URLs and rejects invalid ones", () => {
    const r = safeUrl("/a?b=1", "https://example.com");
    assert.ok(r.ok && r.value.href === "https://example.com/a?b=1");
    assert.equal(kindOf(safeUrl("not a url")), "UrlError");
  });

  it("URI coders return errors on malformed input", () => {
    assert.deepEqual(safeDecodeURIComponent("a%20b"), { ok: true, value: "a b" });
    assert.equal(kindOf(safeDecodeURIComponent("%E0%A4%A")), "UriCodingError");
    assert.equal(kindOf(safeEncodeURIComponent("\uD800")), "UriCodingError");
    assert.equal(kindOf(safeDecodeURI("%")), "UriCodingError");
    assert.equal(kindOf(safeEncodeURI("\uDFFF")), "UriCodingError");
  });
});

describe("primitives", () => {
  it("safeBigInt", () => {
    assert.deepEqual(safeBigInt("123"), { ok: true, value: 123n });
    assert.equal(kindOf(safeBigInt("1.5")), "BigIntError");
    assert.equal(kindOf(safeBigInt(1.5)), "BigIntError");
  });

  it("safeStructuredClone", () => {
    assert.deepEqual(safeStructuredClone({ a: [1] }), { ok: true, value: { a: [1] } });
    assert.equal(kindOf(safeStructuredClone({ f: () => 1 })), "CloneError");
  });

  it("safeAtob / safeBtoa", () => {
    assert.deepEqual(safeBtoa("hi"), { ok: true, value: "aGk=" });
    assert.deepEqual(safeAtob("aGk="), { ok: true, value: "hi" });
    assert.equal(kindOf(safeAtob("***")), "Base64Error");
    assert.equal(kindOf(safeBtoa("€")), "Base64Error");
  });

  it("safeRegExp", () => {
    const r = safeRegExp("^a+$", "u");
    assert.ok(r.ok && r.value.test("aaa"));
    assert.equal(kindOf(safeRegExp("(")), "RegExpError");
    assert.equal(kindOf(safeRegExp("a", "zz")), "RegExpError");
  });
});

function numberSchema(options: { async?: boolean; throws?: boolean } = {}): StandardSchemaV1<unknown, number> {
  const check = (value: unknown) =>
    typeof value === "number"
      ? { value }
      : { issues: [{ message: "expected number", path: ["items", 2, { key: "id" }] }] };
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => {
        if (options.throws === true) {
          throw new Error("validator bug");
        }
        return options.async === true ? Promise.resolve(check(value)) : check(value);
      },
    },
  };
}

describe("parseWith", () => {
  it("returns the typed value on success", () => {
    const r = parseWith(numberSchema(), 5);
    assert.ok(r.ok);
    const n: number = r.value;
    assert.equal(n, 5);
  });

  it("returns issues with formatted paths on failure", () => {
    const r = parseWith(numberSchema(), "x");
    assert.ok(!r.ok && r.error.kind === "SchemaValidationError");
    assert.deepEqual(r.error.issues, [{ message: "expected number", path: "items[2].id" }]);
    assert.equal(r.error.message, "items[2].id: expected number");
  });

  it("refuses async schemas without leaking a rejection", () => {
    assert.equal(kindOf(parseWith(numberSchema({ async: true }), 1)), "SchemaAsyncNotSupported");
  });

  it("captures a validator that throws", () => {
    assert.equal(kindOf(parseWith(numberSchema({ throws: true }), 1)), "SchemaThrew");
  });
});

describe("parseWithAsync", () => {
  it("supports async and sync schemas", async () => {
    assert.deepEqual(await parseWithAsync(numberSchema({ async: true }), 1), { ok: true, value: 1 });
    assert.deepEqual(await parseWithAsync(numberSchema(), 2), { ok: true, value: 2 });
    assert.equal(kindOf(await parseWithAsync(numberSchema({ async: true }), "x")), "SchemaValidationError");
  });

  it("captures a validator that throws", async () => {
    assert.equal(kindOf(await parseWithAsync(numberSchema({ throws: true }), 1)), "SchemaThrew");
  });
});
