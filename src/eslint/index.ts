import tseslint from "typescript-eslint";
import type { FlatConfig } from "typescript-eslint";
import { plugin } from "./plugin.ts";
import { ESLINT_RECOMMENDED } from "./recommended.ts";

export interface StrictTsOptions {
  readonly files?: readonly string[] | undefined;
  readonly boundary?: readonly string[] | undefined;
  readonly tests?: readonly string[] | undefined;
  readonly throwingModules?: readonly string[] | undefined;
  readonly allowInlineDisable?: boolean | undefined;
  readonly tsconfigRootDir?: string | undefined;
}

export const DEFAULT_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];
export const DEFAULT_BOUNDARY = ["**/*.boundary.ts", "**/*.boundary.tsx", "**/boundary/**"];
export const DEFAULT_TESTS = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/__tests__/**"];

const NODE_TEST_FUNCTIONS = ["describe", "suite", "it", "test", "before", "after", "beforeEach", "afterEach"];

interface Restriction {
  readonly selector: string;
  readonly message: string;
}

const restrictedSyntax: readonly Restriction[] = [
  { selector: "ThrowStatement", message: "Don't throw. Return err(...) from strict-ts." },
  {
    selector: "TryStatement",
    message: "try/catch belongs in boundary files. Use attempt()/attemptAsync() there, or a strict-ts/safe wrapper.",
  },
  {
    selector: "CallExpression[callee.object.name='Promise'][callee.property.name='reject']",
    message: "Promise.reject throws asynchronously. Return err(...) from strict-ts.",
  },
  {
    selector: "NewExpression[callee.name='Promise']",
    message: "new Promise belongs in boundary files, where its rejections are turned into Results.",
  },
  { selector: "NewExpression[callee.name='URL']", message: "new URL throws on invalid input. Use safeUrl from strict-ts/safe." },
  { selector: "CallExpression[callee.name='BigInt']", message: "BigInt() throws on invalid input. Use safeBigInt from strict-ts/safe." },
  {
    selector: ":matches(NewExpression, CallExpression)[callee.name='RegExp']",
    message: "RegExp() throws on invalid patterns. Use a regex literal, or safeRegExp from strict-ts/safe.",
  },
  {
    selector: "CallExpression[callee.property.name='json'][arguments.length=0]",
    message: "Response.json() throws on invalid JSON. Use fetchJson, or readBody + safeJsonParse from strict-ts/safe.",
  },
  { selector: "WhileStatement", message: "Unbounded loop. Use for...of, a counted for loop, or array methods." },
  { selector: "DoWhileStatement", message: "Unbounded loop. Use for...of, a counted for loop, or array methods." },
  { selector: "ForStatement[test=null]", message: "Unbounded loop. Give the for loop a condition." },
  { selector: ":function[generator=true]", message: "Generators can run unbounded. Use arrays or for...of." },
];

const restrictedProperties = [
  { object: "JSON", property: "parse", message: "JSON.parse throws. Use safeJsonParse from strict-ts/safe." },
  { object: "JSON", property: "stringify", message: "JSON.stringify throws on BigInt and cycles. Use safeJsonStringify from strict-ts/safe." },
  ...["globalThis", "window", "self"].map((object) => ({
    object,
    property: "fetch",
    message: "fetch rejects and has no timeout. Use safeFetch or fetchJson from strict-ts/safe.",
  })),
];

const restrictedGlobals = [
  ...(["decodeURIComponent", "encodeURIComponent", "decodeURI", "encodeURI"] as const).map((name) => ({
    name,
    message: `${name} throws URIError. Use safe${name.charAt(0).toUpperCase()}${name.slice(1)} from strict-ts/safe.`,
  })),
  { name: "structuredClone", message: "structuredClone throws on uncloneable values. Use safeStructuredClone from strict-ts/safe." },
  { name: "atob", message: "atob throws on invalid input. Use safeAtob from strict-ts/safe." },
  { name: "btoa", message: "btoa throws on non-Latin-1 input. Use safeBtoa from strict-ts/safe." },
  { name: "fetch", message: "fetch rejects and has no timeout. Use safeFetch or fetchJson from strict-ts/safe." },
  { name: "setInterval", message: "setInterval runs unbounded. Schedule work explicitly with setTimeout or a job runner." },
];

function restrictedImports(modules: readonly string[]): FlatConfig.RuleEntry {
  return [
    "error",
    {
      patterns: modules.map((name) => ({
        regex: `^${name.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:/.*)?$`,
        allowTypeImports: true,
        message: `${name} can throw. Import it only in boundary files and expose Result-returning functions.`,
      })),
    },
  ];
}

const recommendedCoreRules: FlatConfig.Rules = Object.fromEntries(ESLINT_RECOMMENDED.map((name) => [name, "error"]));

export function strictTs(options: StrictTsOptions = {}): FlatConfig.Config[] {
  const files = [...(options.files ?? DEFAULT_FILES)];
  const boundary = [...(options.boundary ?? DEFAULT_BOUNDARY)];
  const tests = [...(options.tests ?? DEFAULT_TESTS)];
  const throwingModules = options.throwingModules ?? [];

  const typescriptConfigs: FlatConfig.Config[] = tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files,
  }));

  return [
    {
      name: "strict-ts/linter-options",
      linterOptions: {
        noInlineConfig: options.allowInlineDisable !== true,
        reportUnusedDisableDirectives: "error",
      },
    },
    { name: "strict-ts/eslint-recommended", files, rules: recommendedCoreRules },
    ...typescriptConfigs,
    {
      name: "strict-ts/rules",
      files,
      plugins: { "strict-ts": plugin },
      languageOptions: {
        parserOptions: {
          projectService: true,
          ...(options.tsconfigRootDir === undefined ? {} : { tsconfigRootDir: options.tsconfigRootDir }),
        },
      },
      rules: {
        "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
        "@typescript-eslint/no-non-null-assertion": "error",
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/ban-ts-comment": [
          "error",
          { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true, "ts-check": false },
        ],
        "@typescript-eslint/switch-exhaustiveness-check": [
          "error",
          { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: true },
        ],
        "@typescript-eslint/strict-boolean-expressions": [
          "error",
          { allowString: false, allowNumber: false, allowNullableObject: true },
        ],
        "@typescript-eslint/no-unnecessary-condition": "error",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/restrict-template-expressions": [
          "error",
          {
            allowNumber: true,
            allowAny: false,
            allowArray: false,
            allowBoolean: false,
            allowNullish: false,
            allowRegExp: false,
            allowNever: false,
          },
        ],
        "@typescript-eslint/no-floating-promises": [
          "error",
          {
            checkThenables: true,
            allowForKnownSafeCalls: [{ from: "package", package: "node:test", name: [...NODE_TEST_FUNCTIONS] }],
          },
        ],
        "@typescript-eslint/no-misused-promises": "error",
        eqeqeq: ["error", "always"],
        "no-unneeded-ternary": ["error", { defaultAssignment: false }],
        "prefer-regex-literals": ["error", { disallowRedundantWrapping: true }],
        "no-self-compare": "error",
        "no-constant-binary-expression": "error",
        "no-cond-assign": ["error", "always"],
        "no-promise-executor-return": "error",
        "no-template-curly-in-string": "error",
        "no-unreachable-loop": "error",
        "prefer-const": "error",
        "no-var": "error",
        "no-eval": "error",
        "no-new-func": "error",
        "strict-ts/must-use-result": "error",
        "strict-ts/bounded-schemas": "error",
        "no-restricted-syntax": ["error", ...restrictedSyntax],
        "no-restricted-properties": ["error", ...restrictedProperties],
        "no-restricted-globals": ["error", ...restrictedGlobals],
        ...(throwingModules.length > 0 ? { "@typescript-eslint/no-restricted-imports": restrictedImports(throwingModules) } : {}),
      },
    },
    {
      name: "strict-ts/boundary",
      files: boundary,
      rules: {
        "no-restricted-syntax": "off",
        "no-restricted-properties": "off",
        "no-restricted-globals": "off",
        "@typescript-eslint/no-restricted-imports": "off",
      },
    },
    {
      name: "strict-ts/tests",
      files: tests,
      rules: {
        "no-restricted-syntax": "off",
        "no-restricted-properties": "off",
        "no-restricted-globals": "off",
        "@typescript-eslint/no-restricted-imports": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "@typescript-eslint/consistent-type-assertions": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/strict-boolean-expressions": "off",
        "strict-ts/bounded-schemas": "off",
      },
    },
  ];
}

export default strictTs;
