import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { Linter } from "eslint";
import { strictTs } from "../src/eslint/index.ts";
import { classifyEslint, classifyTypeScript, isClassifiedRule } from "../src/cli/report/classify.ts";
import { buildReport, expectedRuleSeverities, type Report } from "../src/cli/report/collect.ts";
import { renderJson, renderMarkdown, renderNext } from "../src/cli/report/render.ts";

const fixtureDir = resolve(import.meta.dirname, "fixtures/project");

function config(extra: Linter.Config[] = []): Linter.Config[] {
  const base = strictTs({ throwingModules: ["node:child_process", "node:fs"], tsconfigRootDir: fixtureDir }) as unknown as Linter.Config[];
  return [...base, ...extra];
}

async function report(extra: Linter.Config[] = [], tsconfig?: string): Promise<Report> {
  const built = await buildReport({
    cwd: fixtureDir,
    tsconfig,
    eslintOptions: { overrideConfigFile: true, overrideConfig: config(extra) },
  });
  assert.ok(built.ok, built.ok ? "" : built.error);
  return built.value;
}

describe("classification", () => {
  it("gives every rule strict-ts enables a priority", () => {
    const enabled = [...expectedRuleSeverities()].filter(([, severity]) => severity === 2).map(([rule]) => rule);
    assert.ok(enabled.length > 100);
    assert.deepEqual(enabled.filter((rule) => !isClassifiedRule(rule)), []);
    assert.ok(isClassifiedRule("@typescript-eslint/no-restricted-imports"));
  });

  it("splits the restricted-syntax rule by what it reports", () => {
    assert.equal(classifyEslint("no-restricted-syntax", "Don't throw. Return err(...).").priority, 3);
    assert.equal(classifyEslint("no-restricted-syntax", "Unbounded loop. Use for...of.").priority, 3);
    assert.equal(classifyEslint("no-restricted-syntax", "new URL throws on invalid input.").priority, 2);
    assert.equal(classifyEslint("no-restricted-globals", "setInterval runs unbounded.").priority, 3);
    assert.equal(classifyEslint("no-restricted-globals", "atob throws on invalid input.").priority, 2);
  });

  it("orders compiler errors by consequence", () => {
    assert.equal(classifyTypeScript(2532).priority, 2);
    assert.equal(classifyTypeScript(7030).priority, 1);
    assert.equal(classifyTypeScript(4111).priority, 4);
    assert.equal(classifyTypeScript(99999).priority, 2);
  });
});

describe("buildReport", () => {
  let full: Report;

  before(async () => {
    full = await report();
  });

  it("collects compiler and lint findings with priorities and fixes", () => {
    const find = (file: string, rule: string) => full.findings.find((f) => f.file === file && f.rule === rule);
    assert.equal(find("compiler.ts", "TS2322")?.priority, 2);
    assert.equal(find("correctness.ts", "@typescript-eslint/no-floating-promises")?.priority, 0);
    assert.equal(find("results.ts", "strict-ts/must-use-result")?.priority, 1);
    assert.equal(find("lying.ts", "inline-disable")?.priority, 4);
    assert.ok(full.findings.every((f) => f.fix.length > 0 && f.why.length > 0));
  });

  it("marks test files and sorts production first, then by priority", () => {
    const spec = full.findings.filter((f) => f.file === "relaxed.spec.ts");
    assert.ok(spec.length > 0 && spec.every((f) => f.test));
    const firstTest = full.findings.findIndex((f) => f.test);
    assert.ok(full.findings.slice(firstTest).every((f) => f.test));
    const production = full.findings.slice(0, firstTest).map((f) => f.priority);
    assert.deepEqual(production, [...production].sort((a, b) => a - b));
  });

  it("reports no configuration changes for the strict-ts defaults", () => {
    assert.deepEqual(full.configChanges, []);
  });

  it("reports rules and compiler flags the project weakens", async () => {
    const weakened = await report(
      [{ rules: { "@typescript-eslint/no-explicit-any": "off", eqeqeq: "warn" } }],
      "tsconfig.weak.json",
    );
    assert.deepEqual(
      weakened.configChanges.map((c) => `${c.setting}=${c.actual}`).sort(),
      ["@typescript-eslint/no-explicit-any=off", "eqeqeq=warn", "tsconfig: noUncheckedIndexedAccess=false"],
    );
    assert.ok(!weakened.findings.some((f) => f.rule === "@typescript-eslint/no-explicit-any"));
  });

  it("renders Markdown, JSON and the next-findings list", () => {
    const markdown = renderMarkdown(full, "project");
    assert.ok(markdown.startsWith("# strict-ts report"));
    assert.ok(markdown.includes("## P0: Process can go down"));
    assert.ok(markdown.includes("## Tests"));

    const json = renderJson(full, 3);
    assert.ok(json.ok);
    const parsed: unknown = JSON.parse(json.value);
    assert.ok(typeof parsed === "object" && parsed !== null && "findings" in parsed && Array.isArray(parsed.findings));
    assert.equal(parsed.findings.length, 3);

    const next = renderNext(full, 2);
    assert.ok(next.includes("Showing the first 2"));
    assert.ok(next.includes("1. [P0]"));
    assert.ok(next.includes("   Fix: "));
    assert.ok(!next.includes("3. ["));
  });
});
