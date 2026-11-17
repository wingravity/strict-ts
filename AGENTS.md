# Instructions for coding agents

This file is for work on strict-ts itself. Projects that use strict-ts get their own instructions from `strict-ts init`, and their API reference is `docs/api.md`.

## Before a change is complete

```sh
npm run typecheck
npm run lint
npm test
```

All three must pass. strict-ts lints its own source with its own configuration, so `src/` follows the same rules it enforces:

- Functions that can fail return a `Result`. Do not throw. Only `src/result.ts`, `src/safe/` and `src/node/` may call throwing APIs.
- No `as` (except `as const`), `!`, `any` or `@ts-` comments.
- `// eslint-disable` comments have no effect. Do not add them, and do not weaken `eslint.config.js` or the tsconfig files.

## Conventions

- No code comments, except for logic that cannot be understood from the code itself.
- Runtime code (`src/index.ts`, `src/safe/`, `src/node/`) has no dependencies. Do not add any.
- Tests use `node:test`. Do not add a test framework.
- Documentation uses a formal, factual tone and no em or en dashes.

## Rules and configuration

- A change to the ESLint configuration or the tsconfig needs matching lines in `test/fixtures/project`, each marked `// @expect <rule>`. The test fails on a missing or an extra finding.
- Every rule the configuration enables needs a priority, a reason and a fix hint in `src/cli/report/classify.ts`.
- Custom rules in `src/eslint/rules/` need valid and invalid cases in `test/rules.test.ts`.
- When behavior or options change, update `README.md` and `docs/api.md`.

See `CONTRIBUTING.md` for details.
