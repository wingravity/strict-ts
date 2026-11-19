import { after, describe, it } from "node:test";
import { resolve } from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { mustUseResult } from "../src/eslint/rules/must-use-result.ts";
import { boundedSchemas } from "../src/eslint/rules/bounded-schemas.ts";
import { noMutableArrayWidening } from "../src/eslint/rules/no-mutable-array-widening.ts";

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

const animals = `
interface Animal { readonly name: string }
interface Dog extends Animal { bark(): void }
interface Cat extends Animal { meow(): void }
declare const rex: Dog;
declare const dogs: Dog[];
declare const readonlyDogs: readonly Dog[];
declare const pair: [Dog, Dog];
declare const holder: { dogs: Dog[] };
declare const flag: boolean;
declare function addAnimal(list: Animal[]): void;
declare function readAnimals(list: readonly Animal[]): void;
declare function first<T>(list: T[]): T | undefined;
`;

typed.run("no-mutable-array-widening", noMutableArrayWidening, {
  valid: [
    `${animals} export const a: readonly Animal[] = dogs;`,
    `${animals} export const a: Dog[] = dogs;`,
    `${animals} export const a: Animal[] = [rex];`,
    `${animals} export const a: Animal[] = [...dogs];`,
    `${animals} export const a: Animal[] = dogs.slice();`,
    `${animals} export const a = dogs;`,
    `${animals} export const a: readonly Animal[] = readonlyDogs;`,
    `${animals} readAnimals(dogs);`,
    `${animals} export const d = first(dogs);`,
    `${animals} export const names: string[] = dogs.map((d) => d.name);`,
  ],
  invalid: [
    { code: `${animals} export const a: Animal[] = dogs;`, errors: [{ messageId: "widened" }] },
    { code: `${animals} let a: Animal[] = []; a = dogs; export { a };`, errors: [{ messageId: "widened" }] },
    { code: `${animals} addAnimal(dogs);`, errors: [{ messageId: "widened" }] },
    { code: `${animals} export function f(): Animal[] { return dogs; }`, errors: [{ messageId: "widened" }] },
    { code: `${animals} export const f = (): Animal[] => dogs;`, errors: [{ messageId: "widened" }] },
    { code: `${animals} export const o: { list: Animal[] } = { list: dogs };`, errors: [{ messageId: "widened" }] },
    { code: `${animals} export const a: Animal[] = holder.dogs;`, errors: [{ messageId: "widened" }] },
    { code: `${animals} export const a: (Dog | Cat)[] = dogs;`, errors: [{ messageId: "widened" }] },
    { code: `${animals} export const a: Animal[] = flag ? dogs : [];`, errors: [{ messageId: "widened" }] },
    { code: `${animals} export const a: Animal[] = pair;`, errors: [{ messageId: "widened" }] },
    { code: `${animals} export const a: Animal[][] = [dogs];`, errors: [{ messageId: "widened" }] },
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
