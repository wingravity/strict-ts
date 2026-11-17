import { attempt, err, ok } from "../result.js";
import { describeCause, taggedError } from "../error.js";
export const DEFAULT_JSON_MAX_LENGTH = 1_000_000;
export const DEFAULT_JSON_MAX_DEPTH = 64;
const QUOTE = "\"".charCodeAt(0);
const BACKSLASH = "\\".charCodeAt(0);
const OPEN_BRACE = "{".charCodeAt(0);
const CLOSE_BRACE = "}".charCodeAt(0);
const OPEN_BRACKET = "[".charCodeAt(0);
const CLOSE_BRACKET = "]".charCodeAt(0);
export function jsonNestingDepth(text) {
    let depth = 0;
    let maxDepth = 0;
    let inString = false;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (inString) {
            if (c === BACKSLASH) {
                i++;
            }
            else if (c === QUOTE) {
                inString = false;
            }
        }
        else if (c === QUOTE) {
            inString = true;
        }
        else if (c === OPEN_BRACE || c === OPEN_BRACKET) {
            depth++;
            maxDepth = Math.max(maxDepth, depth);
        }
        else if (c === CLOSE_BRACE || c === CLOSE_BRACKET) {
            depth--;
        }
    }
    return maxDepth;
}
export function safeJsonParse(text, limits = {}) {
    const maxLength = limits.maxLength ?? DEFAULT_JSON_MAX_LENGTH;
    const maxDepth = limits.maxDepth ?? DEFAULT_JSON_MAX_DEPTH;
    if (text.length > maxLength) {
        return err(taggedError("JsonTooLarge", `JSON input is ${String(text.length)} chars, limit is ${String(maxLength)}`));
    }
    const depth = jsonNestingDepth(text);
    if (depth > maxDepth) {
        return err(taggedError("JsonTooDeep", `JSON nesting depth ${String(depth)} exceeds limit ${String(maxDepth)}`));
    }
    return attempt(() => JSON.parse(text), (cause) => taggedError("JsonSyntaxError", describeCause(cause), cause));
}
export function safeJsonStringify(value, indent) {
    const result = attempt(() => JSON.stringify(value, null, indent), (cause) => taggedError("JsonStringifyError", describeCause(cause), cause));
    if (!result.ok) {
        return result;
    }
    if (result.value === undefined) {
        return err(taggedError("JsonNotSerializable", `a value of type ${typeof value} has no JSON representation`));
    }
    return ok(result.value);
}
//# sourceMappingURL=json.js.map