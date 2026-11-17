# strict-ts API reference

Reference for code written in projects that use strict-ts. Every function listed here returns a `Result` or an `AsyncResult` and never throws.

## Rules that shape the code

- A function that can fail returns `Result<T, E>` or `AsyncResult<T, E>`. It does not throw.
- A Result must be used: check `.ok`, return it, or pass it on. Discarding it is a lint error.
- `as` (except `as const`), `!`, `any` and `@ts-` comments are not allowed. Narrow values with checks, or validate them with `parseWith`.
- `throw`, `try`, `new Promise` and `Promise.reject` are allowed only in boundary files (`*.boundary.ts`, `boundary/`).
- Built-ins that throw (`JSON.parse`, `JSON.stringify`, `new URL`, `fetch`, `response.json()`, `decodeURIComponent`, `encodeURIComponent`, `decodeURI`, `encodeURI`, `BigInt()`, `structuredClone`, `atob`, `btoa`, `new RegExp`) are replaced by the functions in `strict-ts/safe`.
- `while`, `do...while`, `for(;;)`, generators and `setInterval` are not allowed. Use `for...of`, counted `for` loops and array methods.
- Indexed access returns `T | undefined`. Check before use.
- In `if` conditions, compare strings and numbers explicitly (`text !== ""`, `count > 0`).
- A `switch` over a union must list every member. `default` does not count.

## `strict-ts`

```ts
interface Ok<T> { readonly ok: true; readonly value: T }
interface Err<E> { readonly ok: false; readonly error: E }
type Result<T, E> = Ok<T> | Err<E>;
type AsyncResult<T, E> = Promise<Result<T, E>>;

ok(): Ok<undefined>
ok<T>(value: T): Ok<T>
err<E>(error: E): Err<E>
map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>
mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>
andThen<T, E, U, F>(result: Result<T, E>, fn: (value: T) => Result<U, F>): Result<U, E | F>
unwrapOr<T, U>(result: Result<T, unknown>, fallback: U): T | U
match<T, E, U>(result: Result<T, E>, handlers: { ok: (value: T) => U; err: (error: E) => U }): U
all<T, E>(results: readonly Result<T, E>[]): Result<T[], E>
attempt<T, E>(fn: () => T, toError: (cause: unknown) => E): Result<T, E>
attemptAsync<T, E>(fn: () => T | PromiseLike<T>, toError: (cause: unknown) => E): AsyncResult<T, E>

interface TaggedError<K extends string> { readonly kind: K; readonly message: string; readonly cause?: unknown }
taggedError<K extends string>(kind: K, message: string, cause?: unknown): TaggedError<K>
describeCause(cause: unknown): string
```

`attempt` and `attemptAsync` are the way to call code that may throw. Use them in boundary files.

### Patterns

```ts
function loadUser(id: string): AsyncResult<User, LoadError> { ... }

const user = await loadUser(id);
if (!user.ok) return user;
use(user.value);
```

```ts
type LoadError =
  | { readonly kind: "NotFound"; readonly id: string }
  | { readonly kind: "Invalid"; readonly message: string };

switch (error.kind) {
  case "NotFound":
    return notFound(error.id);
  case "Invalid":
    return badRequest(error.message);
}
```

## `strict-ts/safe`

| Function | Returns | Error kinds |
|---|---|---|
| `safeJsonParse(text, { maxLength?, maxDepth? })` | `Result<unknown, JsonParseError>` | `JsonTooLarge`, `JsonTooDeep`, `JsonSyntaxError` |
| `safeJsonStringify(value, indent?)` | `Result<string, JsonStringifyError>` | `JsonStringifyError`, `JsonNotSerializable` |
| `safeUrl(input, base?)` | `Result<URL, UrlError>` | `UrlError` |
| `safeDecodeURIComponent(s)`, `safeEncodeURIComponent(s)`, `safeDecodeURI(s)`, `safeEncodeURI(s)` | `Result<string, UriCodingError>` | `UriCodingError` |
| `safeBigInt(value)` | `Result<bigint, BigIntError>` | `BigIntError` |
| `safeStructuredClone(value)` | `Result<T, CloneError>` | `CloneError` |
| `safeAtob(data)`, `safeBtoa(data)` | `Result<string, Base64Error>` | `Base64Error` |
| `safeRegExp(pattern, flags?)` | `Result<RegExp, RegExpError>` | `RegExpError` |
| `parseWith(schema, input)` | `Result<Output, SchemaError>` | `SchemaValidationError`, `SchemaAsyncNotSupported`, `SchemaThrew` |
| `parseWithAsync(schema, input)` | `AsyncResult<Output, SchemaError>` | as above |
| `safeFetch(input, { timeoutMs, ...RequestInit })` | `AsyncResult<Response, FetchError>` | `FetchTimeout`, `FetchAborted`, `FetchNetworkError`, `FetchInvalidOptions` |
| `readBody(response, { maxBytes? })` | `AsyncResult<string, BodyError>` | `BodyTooLarge`, `BodyReadError` |
| `fetchJson(input, schema, { timeoutMs, maxBytes?, maxDepth?, ...RequestInit })` | `AsyncResult<Output, FetchJsonError>` | all fetch, body, JSON and schema kinds, plus `HttpStatusError` (with `status`) |

Defaults: JSON input 1,000,000 characters and depth 64; response bodies 10 MB.

`parseWith` accepts any Standard Schema: Zod, Valibot, ArkType. A `SchemaValidationError` has `issues: { message, path }[]`.

`safeFetch` returns non-2xx responses as success. `fetchJson` returns them as `HttpStatusError`.

```ts
const User = z.object({ id: z.number(), name: z.string().max(200) });
const user = parseWith(User, body);
if (!user.ok) return badRequest(user.error.message);
```

## `strict-ts/node`

| Function | Returns |
|---|---|
| `readTextFile(path, { maxBytes? })` | `AsyncResult<string, FsError \| FileTooLargeError>` |
| `writeTextFile(path, content)` | `AsyncResult<void, FsError>` |
| `readDir(path)` | `AsyncResult<string[], FsError>` |
| `stat(path)` | `AsyncResult<Stats, FsError>` |
| `ensureDir(path)` | `AsyncResult<void, FsError>` |

`FsError` has `code` (such as `ENOENT`) and `path`. File reads default to 10 MB.

```ts
installProcessGuards({
  log: (event) => logger.error(event),
  onFatal: () => flushErrors(),
  onShutdown: (signal) => server.close(),
  timeoutMs: 5_000,
});
```

On an uncaught exception or unhandled rejection it logs, runs `onFatal` and exits 1. On `SIGTERM` or `SIGINT` it runs `onShutdown` and exits 0, or 1 if the hook fails or exceeds `timeoutMs`. It returns a function that removes the handlers.

## Boundary files

```ts
// payments.boundary.ts
import Stripe from "stripe";
import { attemptAsync, type AsyncResult } from "strict-ts";

const stripe = new Stripe(apiKey);

export function createCustomer(email: string): AsyncResult<Stripe.Customer, PaymentError> {
  return attemptAsync(
    () => stripe.customers.create({ email }),
    (cause) => ({ kind: "StripeError", message: String(cause), cause }),
  );
}
```

Packages listed in `throwingModules` in `eslint.config.js` can be imported only from boundary files.

## Commands

- `npm run check`: `tsc --noEmit && eslint .`
- `npx strict-ts report`: writes `strict-ts-report.md` with all findings grouped by priority.
- `npx strict-ts report --next 20`: the 20 highest-priority findings with fix instructions.
- `npx strict-ts report --format json`: the same data as JSON.
