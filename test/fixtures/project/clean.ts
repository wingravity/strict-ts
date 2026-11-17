import { err, ok, type Result } from "strict-ts";
import { parseWith, safeJsonParse, type StandardSchemaV1 } from "strict-ts/safe";

interface User {
  readonly id: number;
  readonly name: string;
}

type LoadError = { readonly kind: "NotFound" } | { readonly kind: "Invalid"; readonly message: string };

declare const userSchema: StandardSchemaV1<unknown, User>;

export function loadUser(text: string): Result<User, LoadError> {
  const json = safeJsonParse(text);
  if (!json.ok) {
    return err({ kind: "Invalid", message: json.error.message });
  }
  const user = parseWith(userSchema, json.value);
  if (!user.ok) {
    return err({ kind: "Invalid", message: user.error.message });
  }
  return ok(user.value);
}

export function describe(error: LoadError): string {
  switch (error.kind) {
    case "NotFound":
      return "not found";
    case "Invalid":
      return `invalid: ${error.message}`;
  }
}

export function firstName(users: readonly User[]): string {
  const first = users[0];
  return first === undefined ? "nobody" : first.name;
}
