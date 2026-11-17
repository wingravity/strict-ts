import { after, describe, it } from "node:test";
import { resolve } from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { mustUseResult } from "../src/eslint/rules/must-use-result.ts";
import { boundedSchemas } from "../src/eslint/rules/bounded-schemas.ts";

RuleTester.afterAll = after;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const typed = new RuleTester({
  languageOptions: {
    parserOptions: { project: "./tsconfig.json", tsconfigRootDir: resolve(import.meta.dirname, "fixtures/rules") },
  },
});

const header = `
import { ok, map, type Result, type AsyncResult } from "strict-ts";
declare function save(): Result<number, string>;
declare function saveAsync(): AsyncResult<number, string>;
declare function maybe(): Result<number, string> | undefined;
declare function plain(): number;
`;

typed.run("must-use-result", mustUseResult, {
  valid: [
    `${header} const r = save(); export const v = r.ok;`,
    `${header} export function f(): Result<number, string> { return save(); }`,
    `${header} export const okay = save().ok;`,
    `${header} plain();`,
    `${header} export async function f() { const r = await saveAsync(); return r; }`,
    `${header} export const all = [1].map(() => save());`,
    `${header} export const handler = (): Result<number, string> => save();`,
    `interface Ok<T> { ok: true; value: T } declare function local(): Ok<number>; local();`,
  ],
  invalid: [
    { code: `${header} save();`, errors: [{ messageId: "ignored" }] },
    { code: `${header} void save();`, errors: [{ messageId: "ignored" }] },
    { code: `${header} save(), plain();`, errors: [{ messageId: "ignored" }] },
    { code: `${header} plain(), save();`, errors: [{ messageId: "ignored" }] },
    { code: `${header} saveAsync();`, errors: [{ messageId: "ignored" }] },
    { code: `${header} export async function f() { await saveAsync(); }`, errors: [{ messageId: "ignored" }] },
    { code: `${header} maybe();`, errors: [{ messageId: "ignored" }] },
    { code: `${header} [1].forEach(() => save());`, errors: [{ messageId: "ignored" }] },
    { code: `${header} ok(1);`, errors: [{ messageId: "ignored" }] },
    { code: `${header} map(save(), (n) => n + 1);`, errors: [{ messageId: "ignored" }] },
  ],
});

const untyped = new RuleTester();
const zod = `import { z } from "zod";`;

untyped.run("bounded-schemas", boundedSchemas, {
  valid: [
    `${zod} z.string().max(10);`,
    `${zod} z.string().min(1).max(10);`,
    `${zod} z.string().trim().length(5);`,
    `${zod} z.array(z.string().max(5)).max(10);`,
    `${zod} z.number().array().max(3);`,
    `${zod} z.string().check(z.maxLength(5));`,
    `${zod} z.object({ id: z.number(), name: z.string().max(100) });`,
    `${zod} z.email().max(254);`,
    `import * as zod from "zod/v4"; zod.url().max(2048);`,
    `import { string, maxLength } from "zod/mini"; string().check(maxLength(3));`,
    `import { z } from "other"; z.string();`,
    `import type { z } from "zod"; type S = z.ZodString;`,
    `declare function string(): unknown; string();`,
  ],
  invalid: [
    { code: `${zod} z.string();`, errors: [{ messageId: "unbounded", data: { name: "z.string()" } }] },
    { code: `${zod} z.string().optional();`, errors: [{ messageId: "unbounded" }] },
    { code: `${zod} z.array(z.number());`, errors: [{ messageId: "unbounded", data: { name: "z.array()" } }] },
    { code: `${zod} z.number().array();`, errors: [{ messageId: "unbounded", data: { name: ".array()" } }] },
    { code: `${zod} z.string().max(5).array();`, errors: [{ messageId: "unbounded", data: { name: ".array()" } }] },
    { code: `${zod} z.array(z.string()).max(5);`, errors: [{ messageId: "unbounded", data: { name: "z.string()" } }] },
    { code: `${zod} z.string().array().max(3);`, errors: [{ messageId: "unbounded", data: { name: "z.string()" } }] },
    { code: `${zod} z.email();`, errors: [{ messageId: "unbounded", data: { name: "z.email()" } }] },
    { code: `import zod from "zod"; zod.url();`, errors: [{ messageId: "unbounded", data: { name: "z.url()" } }] },
    { code: `import { string } from "zod/mini"; string();`, errors: [{ messageId: "unbounded" }] },
    { code: `${zod} z.object({ name: z.string() });`, errors: [{ messageId: "unbounded" }] },
  ],
});
