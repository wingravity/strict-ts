import ts from "typescript";
import { err, ok } from "../result.js";
import { safeJsonStringify } from "../safe/json.js";
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function asArray(value) {
    return Array.isArray(value) ? value : [];
}
export function parseJsonc(fileName, text) {
    const parsed = ts.parseConfigFileTextToJson(fileName, text);
    if (parsed.error !== undefined) {
        return err(`${fileName}: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n")}`);
    }
    const config = parsed.config;
    return isRecord(config) ? ok(config) : err(`${fileName}: expected a JSON object`);
}
export function detectIndent(text) {
    const match = /^([ \t]+)"/mu.exec(text);
    return match?.[1] ?? "  ";
}
function propertyName(property) {
    if (!ts.isPropertyAssignment(property)) {
        return undefined;
    }
    const { name } = property;
    return ts.isStringLiteral(name) || ts.isIdentifier(name) ? name.text : undefined;
}
export function setTopLevelProperty(fileName, text, key, value) {
    const source = ts.parseJsonText(fileName, text);
    const root = source.statements[0]?.expression;
    if (root === undefined || !ts.isObjectLiteralExpression(root)) {
        return err(`${fileName}: expected a JSON object`);
    }
    const indent = detectIndent(text);
    const serialized = safeJsonStringify(value, indent.length);
    const serializedKey = safeJsonStringify(key);
    if (!serialized.ok || !serializedKey.ok) {
        return err(`${fileName}: cannot serialize "${key}"`);
    }
    const valueText = serialized.value.replaceAll("\n", `\n${indent}`);
    const entry = `${serializedKey.value}: ${valueText}`;
    const existing = root.properties.find((property) => propertyName(property) === key);
    if (existing !== undefined && ts.isPropertyAssignment(existing)) {
        const start = existing.initializer.getStart(source);
        return ok(text.slice(0, start) + valueText + text.slice(existing.initializer.end));
    }
    const last = root.properties.at(-1);
    if (last === undefined) {
        const start = root.getStart(source);
        return ok(`${text.slice(0, start)}{\n${indent}${entry}\n}${text.slice(root.end)}`);
    }
    if (root.properties.hasTrailingComma) {
        const comma = text.indexOf(",", last.end) + 1;
        return ok(`${text.slice(0, comma)}\n${indent}${entry},${text.slice(comma)}`);
    }
    return ok(`${text.slice(0, last.end)},\n${indent}${entry}${text.slice(last.end)}`);
}
//# sourceMappingURL=jsonc.js.map