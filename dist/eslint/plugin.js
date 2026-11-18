import { boundedSchemas } from "./rules/bounded-schemas.js";
import { mustUseResult } from "./rules/must-use-result.js";
export const plugin = {
    meta: { name: "strict-ts" },
    rules: {
        "must-use-result": mustUseResult,
        "bounded-schemas": boundedSchemas,
    },
};
//# sourceMappingURL=plugin.js.map