import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { ESLint } from "eslint";
import { attempt, attemptAsync, err, ok } from "../../result.js";
import { describeCause } from "../../error.js";
import { readTextFile } from "../../node/fs.js";
import { strictTs } from "../../eslint/index.js";
import { asArray, isRecord, parseJsonc } from "../jsonc.js";
import { SUPPRESSIONS_API_VERSION, supportsSuppressionsApi } from "../eslint-version.js";
import { classifyEslint, classifyTypeScript, INERT_INLINE_DISABLE, UNPARSED_FILE, } from "./classify.js";
const TEST_FILE = /(?:\.(?:test|spec)\.[cm]?tsx?$)|(?:(?:^|\/)__tests__\/)/u;
const BOUNDARY_FILE = /(?:\.boundary\.tsx?$)|(?:(?:^|\/)boundary\/)/u;
const TYPESCRIPT_SOURCE = /(?<!\.d)\.[cm]?tsx?$/u;
export function isTestFile(file) {
    return TEST_FILE.test(file);
}
function finding(base, classification) {
    return { ...base, test: isTestFile(base.file), ...classification };
}
function severityOf(entry) {
    if (typeof entry === "number") {
        return entry;
    }
    if (entry === "error") {
        return 2;
    }
    if (entry === "warn") {
        return 1;
    }
    if (Array.isArray(entry)) {
        return severityOf(asArray(entry)[0]);
    }
    return 0;
}
const SEVERITY_NAMES = ["off", "warn", "error"];
export function expectedRuleSeverities() {
    const expected = new Map();
    for (const config of strictTs()) {
        if (config.name === "strict-ts/boundary" || config.name === "strict-ts/tests") {
            continue;
        }
        for (const [rule, entry] of Object.entries(config.rules ?? {})) {
            expected.set(rule, severityOf(entry));
        }
    }
    return expected;
}
async function expectedCompilerFlags() {
    const path = join(import.meta.dirname, "../../../config/tsconfig.json");
    const text = await readTextFile(path);
    if (!text.ok) {
        return err(`cannot read ${path}: ${text.error.message}`);
    }
    const parsed = parseJsonc(path, text.value);
    if (!parsed.ok) {
        return parsed;
    }
    const options = parsed.value["compilerOptions"];
    return ok(isRecord(options) ? options : {});
}
function collectTypeScript(cwd, tsconfig) {
    const configPath = resolve(cwd, tsconfig);
    const read = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
    if (read.error !== undefined) {
        return err(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
    }
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath));
    const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
    const findings = [];
    for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
        const source = diagnostic.file;
        if (source === undefined || diagnostic.start === undefined || source.fileName.includes("/node_modules/")) {
            continue;
        }
        const position = source.getLineAndCharacterOfPosition(diagnostic.start);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
        findings.push(finding({
            source: "typescript",
            rule: `TS${String(diagnostic.code)}`,
            file: relative(cwd, source.fileName),
            line: position.line + 1,
            column: position.character + 1,
            message,
        }, classifyTypeScript(diagnostic.code)));
    }
    return ok({ findings, options: parsed.options });
}
function classifyMessage(message) {
    if (message.ruleId === null) {
        return message.fatal === true ? UNPARSED_FILE : INERT_INLINE_DISABLE;
    }
    return classifyEslint(message.ruleId, message.message);
}
function eslintRuleName(message) {
    if (message.ruleId !== null) {
        return message.ruleId;
    }
    return message.fatal === true ? "parse-error" : "inline-disable";
}
async function eslintRuleChanges(eslint, file) {
    const config = await attemptAsync(async () => eslint.calculateConfigForFile(file), (cause) => describeCause(cause));
    if (!config.ok || !isRecord(config.value)) {
        return [];
    }
    const rules = config.value["rules"];
    const actual = isRecord(rules) ? rules : {};
    const changes = [];
    for (const [rule, expected] of expectedRuleSeverities()) {
        const severity = severityOf(actual[rule]);
        if (expected === 2 && severity < 2) {
            changes.push({ setting: rule, expected: "error", actual: SEVERITY_NAMES[severity] ?? "off" });
        }
    }
    return changes;
}
async function compilerFlagChanges(options) {
    const expected = await expectedCompilerFlags();
    if (!expected.ok) {
        return [];
    }
    const changes = [];
    for (const [flag, value] of Object.entries(expected.value)) {
        const actual = options[flag];
        if (typeof value === "boolean" && actual !== value) {
            changes.push({
                setting: `tsconfig: ${flag}`,
                expected: String(value),
                actual: typeof actual === "boolean" ? String(actual) : "not set",
            });
        }
    }
    return changes;
}
function compareFindings(a, b) {
    const keys = [
        Number(a.test) - Number(b.test),
        a.priority - b.priority,
        a.file.localeCompare(b.file),
        a.line - b.line,
        a.column - b.column,
    ];
    return keys.find((difference) => difference !== 0) ?? 0;
}
function sortFindings(findings) {
    return [...findings].sort(compareFindings);
}
export async function buildReport(options) {
    const { cwd } = options;
    const typescript = collectTypeScript(cwd, options.tsconfig ?? "tsconfig.json");
    if (!typescript.ok) {
        return typescript;
    }
    const respectSuppressions = options.respectSuppressions === true;
    if (respectSuppressions && !supportsSuppressionsApi(ESLint.version)) {
        return err(`--respect-suppressions needs ESLint ${SUPPRESSIONS_API_VERSION} or later; this project uses ESLint ${ESLint.version}`);
    }
    const created = attempt(() => new ESLint({ cwd, ...(respectSuppressions ? { applySuppressions: true } : {}), ...options.eslintOptions }), (cause) => `ESLint could not start: ${describeCause(cause)}`);
    if (!created.ok) {
        return created;
    }
    const eslint = created.value;
    const results = await attemptAsync(() => eslint.lintFiles(["."]), (cause) => `ESLint failed: ${describeCause(cause)}`);
    if (!results.ok) {
        return results;
    }
    const eslintFindings = results.value.flatMap((result) => result.messages.map((message) => finding({
        source: "eslint",
        rule: eslintRuleName(message),
        file: relative(cwd, result.filePath),
        line: message.line,
        column: message.column,
        message: message.message,
    }, classifyMessage(message))));
    const sample = results.value.find((result) => {
        const file = relative(cwd, result.filePath);
        return TYPESCRIPT_SOURCE.test(file) && !isTestFile(file) && !BOUNDARY_FILE.test(file);
    });
    const ruleChanges = sample === undefined ? [] : await eslintRuleChanges(eslint, sample.filePath);
    const flagChanges = await compilerFlagChanges(typescript.value.options);
    return ok({
        generatedAt: new Date().toISOString(),
        project: cwd,
        findings: sortFindings([...typescript.value.findings, ...eslintFindings]),
        configChanges: [...flagChanges, ...ruleChanges],
    });
}
//# sourceMappingURL=collect.js.map