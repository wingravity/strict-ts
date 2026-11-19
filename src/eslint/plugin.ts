import { boundedSchemas } from "./rules/bounded-schemas.ts";
import { mustUseResult } from "./rules/must-use-result.ts";
import { noMutableArrayWidening } from "./rules/no-mutable-array-widening.ts";

export const plugin = {
  meta: { name: "strict-ts" },
  rules: {
    "must-use-result": mustUseResult,
    "bounded-schemas": boundedSchemas,
    "no-mutable-array-widening": noMutableArrayWidening,
  },
};
