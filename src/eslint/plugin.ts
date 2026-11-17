import { boundedSchemas } from "./rules/bounded-schemas.ts";
import { mustUseResult } from "./rules/must-use-result.ts";

export const plugin = {
  meta: { name: "strict-ts" },
  rules: {
    "must-use-result": mustUseResult,
    "bounded-schemas": boundedSchemas,
  },
};
