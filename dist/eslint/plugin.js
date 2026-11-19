import { boundedSchemas } from "./rules/bounded-schemas.js";
import { mustUseResult } from "./rules/must-use-result.js";
import { noMutableArrayWidening } from "./rules/no-mutable-array-widening.js";
export const plugin = {
    meta: { name: "strict-ts" },
    rules: {
        "must-use-result": mustUseResult,
        "bounded-schemas": boundedSchemas,
        "no-mutable-array-widening": noMutableArrayWidening,
    },
};
//# sourceMappingURL=plugin.js.map