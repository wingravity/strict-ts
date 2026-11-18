# Contributing

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

strict-ts lints its own source with its own configuration. `src/result.ts`, `src/safe/` and `src/node/` contain the only code allowed to call throwing APIs.

## Rules and configuration

Every rule and compiler flag is covered by `test/fixtures/project`, a project of intentionally incorrect code. Each line that must be reported ends with a marker:

```ts
export const parsed: unknown = JSON.parse("{}"); // @expect no-restricted-properties
```

The test fails when a marked finding is missing or an unmarked finding appears. A change to the configuration needs matching fixture lines.

Every rule the configuration enables needs a priority, a reason and a fix hint in `src/cli/report/classify.ts`. A test fails when one is missing.

Custom rules in `src/eslint/rules/` are tested with `RuleTester` in `test/rules.test.ts`, with valid and invalid cases.

## Scope

strict-ts reports code that can fail at runtime. Style, formatting and maintainability rules are out of scope.

## Pull requests

Keep changes focused. Code comments are reserved for logic that cannot be understood from the code itself.

## Releases

`main` holds source only. Running the **Release** workflow with a version such as `0.2.0` runs the checks, builds, commits `dist/` onto a release commit, tags it `v0.2.0`, and moves the `release` branch (the repository's default) to it. That is why `npx github:wingravity/strict-ts init` runs the latest release, and why installs never need a build step.
