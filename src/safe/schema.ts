import { attempt, attemptAsync, err, ok, type AsyncResult, type Result } from "../result.ts";
import { describeCause } from "../error.ts";

export interface StandardPathSegment {
  readonly key: PropertyKey;
}

export interface StandardIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | StandardPathSegment)[] | undefined;
}

export type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly StandardIssue[] };

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}

export type InferOutput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["output"];

export interface SchemaIssue {
  readonly message: string;
  readonly path: string;
}

export type SchemaError =
  | { readonly kind: "SchemaValidationError"; readonly message: string; readonly issues: readonly SchemaIssue[] }
  | { readonly kind: "SchemaAsyncNotSupported"; readonly message: string }
  | { readonly kind: "SchemaThrew"; readonly message: string; readonly cause: unknown };

const MAX_SUMMARY_ISSUES = 5;

function formatPath(path: StandardIssue["path"]): string {
  if (path === undefined) {
    return "";
  }
  const parts = path.map((segment) => {
    const key = typeof segment === "object" ? segment.key : segment;
    return typeof key === "number" ? `[${String(key)}]` : `.${String(key)}`;
  });
  return parts.join("").replace(/^\./u, "");
}

function settle<O>(result: StandardResult<O>): Result<O, SchemaError> {
  if (result.issues === undefined) {
    return ok(result.value);
  }
  const issues = result.issues.map((issue) => ({ message: issue.message, path: formatPath(issue.path) }));
  const message = issues
    .slice(0, MAX_SUMMARY_ISSUES)
    .map((issue) => (issue.path === "" ? issue.message : `${issue.path}: ${issue.message}`))
    .join("; ");
  return err({ kind: "SchemaValidationError", message, issues });
}

function threw(cause: unknown): SchemaError {
  return { kind: "SchemaThrew", message: describeCause(cause), cause };
}

export function parseWith<S extends StandardSchemaV1>(schema: S, input: unknown): Result<InferOutput<S>, SchemaError> {
  const validated = attempt(() => schema["~standard"].validate(input), threw);
  if (!validated.ok) {
    return validated;
  }
  if (validated.value instanceof Promise) {
    validated.value.catch(() => undefined);
    return err({
      kind: "SchemaAsyncNotSupported",
      message: "schema uses async validation; use parseWithAsync",
    });
  }
  return settle(validated.value);
}

export async function parseWithAsync<S extends StandardSchemaV1>(
  schema: S,
  input: unknown,
): AsyncResult<InferOutput<S>, SchemaError> {
  const validated = await attemptAsync(() => schema["~standard"].validate(input), threw);
  return validated.ok ? settle(validated.value) : validated;
}
