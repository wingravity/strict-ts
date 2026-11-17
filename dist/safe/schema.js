import { attempt, attemptAsync, err, ok } from "../result.js";
import { describeCause } from "../error.js";
const MAX_SUMMARY_ISSUES = 5;
function formatPath(path) {
    if (path === undefined) {
        return "";
    }
    const parts = path.map((segment) => {
        const key = typeof segment === "object" ? segment.key : segment;
        return typeof key === "number" ? `[${String(key)}]` : `.${String(key)}`;
    });
    return parts.join("").replace(/^\./u, "");
}
function settle(result) {
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
function threw(cause) {
    return { kind: "SchemaThrew", message: describeCause(cause), cause };
}
export function parseWith(schema, input) {
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
export async function parseWithAsync(schema, input) {
    const validated = await attemptAsync(() => schema["~standard"].validate(input), threw);
    return validated.ok ? settle(validated.value) : validated;
}
//# sourceMappingURL=schema.js.map