export type Priority = 0 | 1 | 2 | 3 | 4;

export const PRIORITY_TITLES: Readonly<Record<Priority, string>> = {
  0: "Process can go down",
  1: "Silent wrong result",
  2: "Request fails",
  3: "Weak error handling",
  4: "No runtime effect",
};

export const PRIORITY_DESCRIPTIONS: Readonly<Record<Priority, string>> = {
  0: "Can stop the whole process, affecting every request in flight.",
  1: "Can produce wrong data or behavior without any error being raised.",
  2: "Can throw at runtime and fail the current request or job.",
  3: "Not a bug today, but makes failures more likely or harder to handle.",
  4: "Clarity and maintenance only.",
};

export interface Classification {
  readonly priority: Priority;
  readonly why: string;
  readonly fix: string;
}

function group(priority: Priority, why: string, fix: string, ids: readonly string[]): [string, Classification][] {
  return ids.map((id) => [id, { priority, why, fix }]);
}

const UNDEFINED_ACCESS: Classification = {
  priority: 2,
  why: "The value can be undefined at runtime, and using it throws a TypeError.",
  fix: "Check for undefined first (`if (value === undefined) return ...`) or use `?.`. Do not add `!`.",
};

const TYPESCRIPT_CODES = new Map<number, Classification>([
  [2532, UNDEFINED_ACCESS],
  [18047, UNDEFINED_ACCESS],
  [18048, UNDEFINED_ACCESS],
  [18049, UNDEFINED_ACCESS],
  [2339, UNDEFINED_ACCESS],
  [2722, UNDEFINED_ACCESS],
  [2721, UNDEFINED_ACCESS],
  [2538, UNDEFINED_ACCESS],
  [
    2345,
    {
      priority: 2,
      why: "A value of the wrong type, often possibly undefined, is passed on.",
      fix: "Narrow the value before passing it, for example by checking for undefined.",
    },
  ],
  [
    2322,
    {
      priority: 2,
      why: "A value of the wrong type, often possibly undefined, is assigned.",
      fix: "Narrow the value before assigning it, or change the target type deliberately.",
    },
  ],
  [
    18046,
    {
      priority: 2,
      why: "A caught or unknown value is used as if its type were known.",
      fix: "Narrow it first, for example `cause instanceof Error`.",
    },
  ],
  [
    2307,
    {
      priority: 0,
      why: "A module cannot be resolved, so loading this file fails.",
      fix: "Fix the import path or install the missing package.",
    },
  ],
  [
    7030,
    {
      priority: 1,
      why: "Some code paths return undefined without saying so.",
      fix: "Return a value on every path, or make the return type include undefined explicitly.",
    },
  ],
  [
    7029,
    {
      priority: 1,
      why: "A switch case falls through into the next one.",
      fix: "End the case with `return` or `break`.",
    },
  ],
  [
    2367,
    {
      priority: 1,
      why: "The comparison can never be true, so the branch never runs.",
      fix: "Compare values of matching types.",
    },
  ],
  [
    2375,
    {
      priority: 3,
      why: "`undefined` is passed where a property should be left out.",
      fix: "Leave the property out instead of setting it to undefined, or add `| undefined` to the target type.",
    },
  ],
  [
    2379,
    {
      priority: 3,
      why: "`undefined` is passed where a property should be left out.",
      fix: "Leave the property out instead of setting it to undefined, or add `| undefined` to the target type.",
    },
  ],
  [
    4111,
    {
      priority: 4,
      why: "A dynamic key is read with dot notation, which looks like a declared property.",
      fix: 'Use bracket access: `obj["key"]`.',
    },
  ],
  [
    4114,
    {
      priority: 4,
      why: "A method overrides a base class method without saying so.",
      fix: "Add the `override` keyword.",
    },
  ],
  [6133, { priority: 4, why: "Unused code.", fix: "Remove it. Prefix unused parameters with `_`." }],
  [6192, { priority: 4, why: "Unused imports.", fix: "Remove them." }],
  [6196, { priority: 4, why: "Unused declaration.", fix: "Remove it." }],
  [7027, { priority: 4, why: "Unreachable code.", fix: "Remove it." }],
]);

const DEFAULT_TYPESCRIPT: Classification = {
  priority: 2,
  why: "A type error; the code may not behave as its types claim.",
  fix: "Fix the type error at this location.",
};

const ESLINT_RULES = new Map<string, Classification>([
  ...group(
    0,
    "A rejected promise that nothing handles becomes an unhandled rejection, which stops a Node process.",
    "Await or return the promise and handle its failure. Prefer functions that return AsyncResult and check `.ok`.",
    ["@typescript-eslint/no-floating-promises", "@typescript-eslint/no-misused-promises", "no-async-promise-executor"],
  ),
  ...group(0, "Strings are executed as code.", "Remove the dynamic code execution.", [
    "no-eval",
    "no-new-func",
    "@typescript-eslint/no-implied-eval",
  ]),
  ...group(0, "The loop condition moves away from its end, so the loop never terminates.", "Fix the loop direction.", [
    "for-direction",
  ]),
  ...group(
    1,
    "Type checking is bypassed, so wrong data flows on without an error.",
    "Validate the value with `parseWith(schema, value)` from strict-ts/safe, or narrow it with checks. Do not use `as`, `any` or `@ts-` comments.",
    [
      "@typescript-eslint/consistent-type-assertions",
      "@typescript-eslint/no-explicit-any",
      "@typescript-eslint/ban-ts-comment",
      "@typescript-eslint/no-unsafe-argument",
      "@typescript-eslint/no-unsafe-assignment",
      "@typescript-eslint/no-unsafe-call",
      "@typescript-eslint/no-unsafe-member-access",
      "@typescript-eslint/no-unsafe-return",
      "@typescript-eslint/no-unsafe-declaration-merging",
      "@typescript-eslint/no-unsafe-enum-assignment",
      "@typescript-eslint/no-unsafe-enum-comparison",
      "@typescript-eslint/no-unsafe-function-type",
      "@typescript-eslint/no-unsafe-unary-minus",
      "@typescript-eslint/no-unsafe-class-instance-assignment",
    ],
  ),
  ...group(
    1,
    "A Result is discarded, so its error is lost.",
    "Check `.ok` and handle the error, return the Result, or pass it on.",
    ["strict-ts/must-use-result"],
  ),
  ...group(
    1,
    "A truthiness check on a number or an untyped value treats valid values such as 0 as missing.",
    "Compare explicitly: `count !== undefined`, `count > 0`, or narrow the value first.",
    ["@typescript-eslint/strict-boolean-expressions"],
  ),
  ...group(
    1,
    "A case of the union is not handled, so it falls through to the code after the switch.",
    "Add a case for every member of the union. `default` does not count.",
    ["@typescript-eslint/switch-exhaustiveness-check"],
  ),
  ...group(
    1,
    "The value is converted to text in an unintended way, such as `[object Object]` or `undefined`.",
    "Convert the value explicitly before combining it with text.",
    [
      "@typescript-eslint/restrict-plus-operands",
      "@typescript-eslint/restrict-template-expressions",
      "@typescript-eslint/no-base-to-string",
    ],
  ),
  ...group(
    1,
    "The expression does not do what it appears to do, and no error is raised.",
    "Rewrite the expression so its intent is explicit.",
    [
      "eqeqeq",
      "no-self-compare",
      "no-constant-binary-expression",
      "no-constant-condition",
      "use-isnan",
      "no-compare-neg-zero",
      "valid-typeof",
      "no-dupe-else-if",
      "no-duplicate-case",
      "no-cond-assign",
      "no-fallthrough",
      "no-self-assign",
      "no-unsafe-finally",
      "no-loss-of-precision",
      "no-unexpected-multiline",
      "no-sparse-arrays",
      "no-template-curly-in-string",
      "no-unassigned-vars",
      "no-unreachable-loop",
      "no-ex-assign",
      "no-global-assign",
      "no-shadow-restricted-names",
      "no-unused-labels",
      "no-misleading-character-class",
      "no-useless-backreference",
      "no-empty-character-class",
      "no-control-regex",
      "no-irregular-whitespace",
      "no-nonoctal-decimal-escape",
      "no-octal",
      "@typescript-eslint/await-thenable",
      "@typescript-eslint/no-for-in-array",
      "@typescript-eslint/no-array-delete",
      "@typescript-eslint/no-misused-spread",
      "@typescript-eslint/unbound-method",
      "@typescript-eslint/no-unused-expressions",
      "@typescript-eslint/no-duplicate-enum-values",
      "@typescript-eslint/no-mixed-enums",
      "@typescript-eslint/no-dynamic-delete",
      "@typescript-eslint/no-this-alias",
    ],
  ),
  ...group(1, "An empty block, often an empty `catch`, silently swallows what happened.", "Handle the case, or return a Result.", [
    "no-empty",
    "no-empty-static-block",
    "no-empty-pattern",
  ]),
  ...group(
    2,
    "A non-null assertion claims a value exists. If it does not, the next access throws.",
    "Check for null or undefined explicitly instead of asserting.",
    [
      "@typescript-eslint/no-non-null-assertion",
      "@typescript-eslint/no-extra-non-null-assertion",
      "@typescript-eslint/no-non-null-asserted-optional-chain",
      "@typescript-eslint/no-non-null-asserted-nullish-coalescing",
    ],
  ),
  ...group(2, "This can throw a TypeError at runtime.", "Rewrite it so the failing case is handled explicitly.", [
    "no-unsafe-optional-chaining",
    "no-prototype-builtins",
    "no-invalid-regexp",
    "no-case-declarations",
    "no-delete-var",
    "@typescript-eslint/use-unknown-in-catch-callback-variable",
  ]),
  ...group(
    3,
    "Errors are thrown or wrapped inconsistently, so callers cannot rely on them.",
    "Return Results instead of throwing. Code that must throw or catch belongs in a boundary file.",
    [
      "@typescript-eslint/only-throw-error",
      "@typescript-eslint/prefer-promise-reject-errors",
      "preserve-caught-error",
      "no-useless-catch",
      "no-promise-executor-return",
      "@typescript-eslint/return-await",
    ],
  ),
  ...group(
    3,
    "Input of unlimited size is accepted, which can exhaust memory or CPU.",
    "Add `.max(n)` or `.length(n)` to the schema.",
    ["strict-ts/bounded-schemas"],
  ),
  ...group(
    3,
    "The types say this condition is always the same. Either the types are wrong or the code is dead.",
    "Fix the type if the value can really be missing; otherwise remove the check.",
    ["@typescript-eslint/no-unnecessary-condition"],
  ),
  ...group(3, "A deprecated API is used and may be removed or changed.", "Switch to the documented replacement.", [
    "@typescript-eslint/no-deprecated",
  ]),
  ...group(
    3,
    "The SDK can throw, and it is imported outside a boundary file.",
    "Move this import into a `*.boundary.ts` file that exposes Result-returning functions.",
    ["@typescript-eslint/no-restricted-imports", "no-restricted-imports"],
  ),
  ...group(4, "Redundant or unclear code.", "Simplify it as the message describes.", [
    "no-unneeded-ternary",
    "prefer-regex-literals",
    "prefer-const",
    "no-var",
    "prefer-rest-params",
    "prefer-spread",
    "no-useless-assignment",
    "no-useless-escape",
    "no-regex-spaces",
    "no-extra-boolean-cast",
    "no-unused-private-class-members",
    "no-debugger",
    "require-yield",
    "@typescript-eslint/no-confusing-void-expression",
    "@typescript-eslint/require-await",
    "@typescript-eslint/no-array-constructor",
    "@typescript-eslint/no-duplicate-type-constituents",
    "@typescript-eslint/no-empty-object-type",
    "@typescript-eslint/no-extraneous-class",
    "@typescript-eslint/no-generated-empty-object-type",
    "@typescript-eslint/no-invalid-void-type",
    "@typescript-eslint/no-meaningless-void-operator",
    "@typescript-eslint/no-misused-new",
    "@typescript-eslint/no-namespace",
    "@typescript-eslint/no-redundant-type-constituents",
    "@typescript-eslint/no-require-imports",
    "@typescript-eslint/no-unnecessary-boolean-literal-compare",
    "@typescript-eslint/no-unnecessary-template-expression",
    "@typescript-eslint/no-unnecessary-type-arguments",
    "@typescript-eslint/no-unnecessary-type-assertion",
    "@typescript-eslint/no-unnecessary-type-constraint",
    "@typescript-eslint/no-unnecessary-type-conversion",
    "@typescript-eslint/no-unnecessary-type-parameters",
    "@typescript-eslint/no-useless-constructor",
    "@typescript-eslint/no-useless-default-assignment",
    "@typescript-eslint/no-wrapper-object-types",
    "@typescript-eslint/prefer-as-const",
    "@typescript-eslint/prefer-literal-enum-member",
    "@typescript-eslint/prefer-namespace-keyword",
    "@typescript-eslint/prefer-reduce-type-parameter",
    "@typescript-eslint/prefer-return-this-type",
    "@typescript-eslint/related-getter-setter-pairs",
    "@typescript-eslint/triple-slash-reference",
    "@typescript-eslint/unified-signatures",
  ]),
]);

const NEVER_THROW: Classification = {
  priority: 3,
  why: "Throwing and catching outside boundary files hides which code can fail.",
  fix: "Return `err(...)` from strict-ts. Code that must throw or catch belongs in a `*.boundary.ts` file, wrapped with `attempt()` or `attemptAsync()`.",
};

const UNBOUNDED: Classification = {
  priority: 3,
  why: "The loop has no visible bound.",
  fix: "Use `for...of`, a counted `for` loop or array methods.",
};

const THROWING_BUILT_IN: Classification = {
  priority: 2,
  why: "This built-in throws on invalid input.",
  fix: "Use the strict-ts/safe replacement named in the message.",
};

const TRUTHY_STRING_OR_BOOLEAN: Classification = {
  priority: 3,
  why: "A string or boolean is checked for truthiness, so an empty string or a missing value counts as false. This is usually intended, but implicit.",
  fix: 'Compare explicitly: `text !== undefined && text !== ""`, `flag === true`.',
};

function classifyRestricted(ruleId: string, message: string): Classification | undefined {
  if (ruleId === "@typescript-eslint/strict-boolean-expressions") {
    return /\b(?:string|boolean) value\b/u.test(message) ? TRUTHY_STRING_OR_BOOLEAN : undefined;
  }
  if (ruleId === "no-restricted-syntax") {
    if (/^(?:Don't throw|try\/catch|Promise\.reject|new Promise)/u.test(message)) {
      return NEVER_THROW;
    }
    if (/^(?:Unbounded loop|Generators)/u.test(message)) {
      return UNBOUNDED;
    }
    return THROWING_BUILT_IN;
  }
  if (ruleId === "no-restricted-globals") {
    return message.includes("setInterval") ? UNBOUNDED : THROWING_BUILT_IN;
  }
  if (ruleId === "no-restricted-properties") {
    return THROWING_BUILT_IN;
  }
  return undefined;
}

export const UNPARSED_FILE: Classification = {
  priority: 0,
  why: "The file could not be parsed or type-checked, so none of its code is checked.",
  fix: "Fix the parse error, or include the file in the tsconfig used by ESLint.",
};

export const INERT_INLINE_DISABLE: Classification = {
  priority: 4,
  why: "Inline `eslint-disable` comments have no effect under strict-ts.",
  fix: "Remove the comment. Put a deliberate exception in eslint.config.js instead.",
};

const UNKNOWN_RULE: Classification = {
  priority: 4,
  why: "A rule outside the strict-ts set.",
  fix: "Follow the rule's message.",
};

export function classifyTypeScript(code: number): Classification {
  return TYPESCRIPT_CODES.get(code) ?? DEFAULT_TYPESCRIPT;
}

export function classifyEslint(ruleId: string, message: string): Classification {
  return classifyRestricted(ruleId, message) ?? ESLINT_RULES.get(ruleId) ?? UNKNOWN_RULE;
}

export function isClassifiedRule(ruleId: string): boolean {
  return ESLINT_RULES.has(ruleId) || classifyRestricted(ruleId, "") !== undefined;
}
