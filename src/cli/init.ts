import { join } from "node:path";
import { err, ok, type AsyncResult, type Result } from "../result.ts";
import { safeJsonParse, safeJsonStringify } from "../safe/json.ts";
import { ensureDir, readTextFile, writeTextFile, type FsError } from "../node/fs.ts";
import { asArray, isRecord, parseJsonc, setTopLevelProperty } from "./jsonc.ts";
import { SUPPRESSIONS_API_VERSION, supportsSuppressionsApi } from "./eslint-version.ts";

export const TSCONFIG_ENTRY = "strict-ts/tsconfig.json";
export const ESLINT_EXTENSION = "dbaeumer.vscode-eslint";
export const CHECK_SCRIPT = "tsc --noEmit && eslint .";
const PEERS = ["typescript", "eslint", "typescript-eslint"];
const ESLINT_CONFIG_NAMES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
];

export interface InitOptions {
  readonly cwd: string;
  readonly packageSpec: string;
  readonly dryRun?: boolean | undefined;
  readonly force?: boolean | undefined;
}

export type ChangeStatus = "created" | "updated" | "unchanged" | "skipped";

export interface Change {
  readonly file: string;
  readonly status: ChangeStatus;
  readonly detail: string;
  readonly content?: string | undefined;
}

export interface InitReport {
  readonly changes: readonly Change[];
  readonly missingPeers: readonly string[];
  readonly packageManager: string;
  readonly notes: readonly string[];
}

async function readOptional(path: string): AsyncResult<string | undefined, string> {
  const file = await readTextFile(path);
  if (file.ok) {
    return file;
  }
  if (file.error.kind === "FsError" && file.error.code === "ENOENT") {
    return ok(undefined);
  }
  return err(file.error.message);
}

function eslintTemplate(): string {
  return `import strictTs from "strict-ts/eslint";

export default [
  { ignores: ["dist/**", "build/**", "coverage/**"] },
  ...strictTs({
    tsconfigRootDir: import.meta.dirname,
    throwingModules: [],
  }),
];
`;
}

export const AGENTS_START = "<!-- strict-ts:start -->";
export const AGENTS_END = "<!-- strict-ts:end -->";

export function agentsSection(packageManager: string): string {
  return `${AGENTS_START}
## strict-ts

This project uses [strict-ts](https://github.com/wingravity/strict-ts). A change is complete only when \`${packageManager} run check\` passes.

- Functions that can fail return a \`Result\` from \`strict-ts\` (\`ok(value)\`, \`err(error)\`). Callers check \`.ok\`. Do not throw.
- Do not use \`as\` (except \`as const\`), non-null \`!\`, \`any\` or \`@ts-\` comments. Validate external data with \`parseWith(schema, value)\` from \`strict-ts/safe\`.
- Use the \`strict-ts/safe\` replacements for \`JSON.parse\`, \`JSON.stringify\`, \`new URL\`, \`fetch\`, \`response.json()\`, \`decodeURIComponent\` and the other built-ins that throw.
- Code that must call throwing APIs or SDKs goes in \`*.boundary.ts\` files, wrapped with \`attempt()\` or \`attemptAsync()\`, and exposes functions that return Results.
- \`// eslint-disable\` comments have no effect. Do not add them, and do not weaken \`eslint.config.js\` or \`tsconfig.json\` to make the check pass.
- Run \`npx strict-ts report --next 20\` for the highest-priority findings, each with a fix instruction.
- API reference: \`node_modules/strict-ts/docs/api.md\`.
${AGENTS_END}`;
}

function planAgents(text: string | undefined, packageManager: string): Change {
  const file = "AGENTS.md";
  const section = agentsSection(packageManager);
  if (text === undefined) {
    return {
      file,
      status: "created",
      detail: "strict-ts instructions for coding agents",
      content: `# Instructions for coding agents\n\n${section}\n`,
    };
  }
  const start = text.indexOf(AGENTS_START);
  const end = text.indexOf(AGENTS_END);
  if (start === -1 || end < start) {
    return {
      file,
      status: "updated",
      detail: "added strict-ts instructions",
      content: `${text.trimEnd()}\n\n${section}\n`,
    };
  }
  const updated = text.slice(0, start) + section + text.slice(end + AGENTS_END.length);
  return updated === text
    ? { file, status: "unchanged", detail: "strict-ts instructions are current" }
    : { file, status: "updated", detail: "refreshed strict-ts instructions", content: updated };
}

function planClaude(text: string | undefined): Change | undefined {
  if (text === undefined) {
    return undefined;
  }
  const file = "CLAUDE.md";
  if (/^@AGENTS\.md\s*$/mu.test(text)) {
    return { file, status: "unchanged", detail: "already imports AGENTS.md" };
  }
  return {
    file,
    status: "updated",
    detail: "imports AGENTS.md, so Claude Code also reads it",
    content: `@AGENTS.md\n\n${text}`,
  };
}

function planTsconfig(text: string | undefined): Result<Change, string> {
  const file = "tsconfig.json";
  if (text === undefined) {
    return ok({ file, status: "skipped", detail: "not found; create one, then run init again" });
  }
  const parsed = parseJsonc(file, text);
  if (!parsed.ok) {
    return parsed;
  }
  const current = parsed.value["extends"];
  const existing = typeof current === "string" ? [current] : asArray(current);
  if (existing.includes(TSCONFIG_ENTRY)) {
    return ok({ file, status: "unchanged", detail: `already extends ${TSCONFIG_ENTRY}` });
  }
  const next = existing.length === 0 ? TSCONFIG_ENTRY : [...existing, TSCONFIG_ENTRY];
  const updated = setTopLevelProperty(file, text, "extends", next);
  if (!updated.ok) {
    return updated;
  }
  return ok({ file, status: "updated", detail: `extends ${TSCONFIG_ENTRY}`, content: updated.value });
}

interface ExistingFile {
  readonly name: string;
  readonly text: string;
}

function planEslint(existing: ExistingFile | undefined, moduleType: boolean, force: boolean): Change {
  const file = existing?.name ?? (moduleType ? "eslint.config.js" : "eslint.config.mjs");
  if (existing?.text.includes("strict-ts/eslint") === true) {
    return { file, status: "unchanged", detail: "already uses strict-ts/eslint" };
  }
  if (existing !== undefined && !force) {
    return {
      file,
      status: "skipped",
      detail: "already exists; merge the strict-ts config by hand (shown below) or rerun with --force",
    };
  }
  return { file, status: existing === undefined ? "created" : "updated", detail: "strict-ts config", content: eslintTemplate() };
}

function readStringMap(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function planPackageJson(
  text: string,
  pkg: Record<string, unknown>,
  packageSpec: string,
): Result<{ change: Change; missingPeers: string[]; notes: string[] }, string> {
  const file = "package.json";
  const scripts = readStringMap(pkg["scripts"]);
  const devDependencies = readStringMap(pkg["devDependencies"]);
  const dependencies = readStringMap(pkg["dependencies"]);
  const notes: string[] = [];
  const details: string[] = [];
  let content = text;

  if (scripts["check"] === undefined) {
    const updated = setTopLevelProperty(file, content, "scripts", { ...scripts, check: CHECK_SCRIPT });
    if (!updated.ok) {
      return updated;
    }
    content = updated.value;
    details.push(`"check" script`);
  } else if (scripts["check"] !== CHECK_SCRIPT) {
    notes.push(`Kept your existing "check" script. strict-ts expects: ${CHECK_SCRIPT}`);
  }

  if (devDependencies["strict-ts"] === undefined && dependencies["strict-ts"] === undefined) {
    const updated = setTopLevelProperty(file, content, "devDependencies", {
      ...devDependencies,
      "strict-ts": packageSpec,
    });
    if (!updated.ok) {
      return updated;
    }
    content = updated.value;
    details.push(`strict-ts dev dependency (${packageSpec})`);
  }

  const missingPeers = PEERS.filter((name) => devDependencies[name] === undefined && dependencies[name] === undefined);
  const change: Change =
    details.length === 0
      ? { file, status: "unchanged", detail: "check script and strict-ts already present" }
      : { file, status: "updated", detail: details.join(", "), content };
  return ok({ change, missingPeers, notes });
}

function planVscodeExtensions(text: string | undefined): Result<Change, string> {
  const file = ".vscode/extensions.json";
  if (text === undefined) {
    const serialized = safeJsonStringify({ recommendations: [ESLINT_EXTENSION] }, 2);
    return serialized.ok
      ? ok({ file, status: "created", detail: "recommends the ESLint extension", content: `${serialized.value}\n` })
      : err(serialized.error.message);
  }
  const parsed = parseJsonc(file, text);
  if (!parsed.ok) {
    return parsed;
  }
  const recommendations = asArray(parsed.value["recommendations"]);
  if (recommendations.includes(ESLINT_EXTENSION)) {
    return ok({ file, status: "unchanged", detail: "already recommends the ESLint extension" });
  }
  const updated = setTopLevelProperty(file, text, "recommendations", [...recommendations, ESLINT_EXTENSION]);
  return updated.ok
    ? ok({ file, status: "updated", detail: "recommends the ESLint extension", content: updated.value })
    : updated;
}

function planVscodeSettings(text: string | undefined, suppressionsSupported: boolean): Result<Change, string> {
  const file = ".vscode/settings.json";
  const source = text ?? "{}\n";
  const parsed = parseJsonc(file, source);
  if (!parsed.ok) {
    return parsed;
  }
  const details: string[] = [];
  let content = source;
  if (parsed.value["typescript.tsdk"] === undefined) {
    const updated = setTopLevelProperty(file, content, "typescript.tsdk", "node_modules/typescript/lib");
    if (!updated.ok) {
      return updated;
    }
    content = updated.value;
    details.push("project TypeScript version");
  }
  const eslintOptions = readStringMap(parsed.value["eslint.options"]);
  if (suppressionsSupported && eslintOptions["applySuppressions"] !== true) {
    const updated = setTopLevelProperty(file, content, "eslint.options", { ...eslintOptions, applySuppressions: true });
    if (!updated.ok) {
      return updated;
    }
    content = updated.value;
    details.push("ESLint bulk suppressions");
  }
  if (details.length === 0) {
    return ok({ file, status: "unchanged", detail: "already configured" });
  }
  return ok({ file, status: text === undefined ? "created" : "updated", detail: details.join(", "), content });
}

async function projectEslintVersion(cwd: string, pkg: Record<string, unknown>): Promise<string | undefined> {
  const installed = await readOptional(join(cwd, "node_modules/eslint/package.json"));
  if (installed.ok && installed.value !== undefined) {
    const parsed = safeJsonParse(installed.value);
    if (parsed.ok && isRecord(parsed.value) && typeof parsed.value["version"] === "string") {
      return parsed.value["version"];
    }
  }
  const declared = readStringMap(pkg["devDependencies"])["eslint"] ?? readStringMap(pkg["dependencies"])["eslint"];
  return typeof declared === "string" ? declared : undefined;
}

async function detectPackageManager(cwd: string): Promise<string> {
  const lockfiles: readonly [string, string][] = [
    ["pnpm-lock.yaml", "pnpm"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
    ["yarn.lock", "yarn"],
  ];
  for (const [lockfile, manager] of lockfiles) {
    const found = await readOptional(join(cwd, lockfile));
    if (found.ok && found.value !== undefined) {
      return manager;
    }
  }
  return "npm";
}

async function findEslintConfig(cwd: string): Promise<ExistingFile | undefined> {
  for (const name of ESLINT_CONFIG_NAMES) {
    const found = await readOptional(join(cwd, name));
    if (found.ok && found.value !== undefined) {
      return { name, text: found.value };
    }
  }
  return undefined;
}

export async function planInit(options: InitOptions): AsyncResult<InitReport, string> {
  const { cwd } = options;
  const packageText = await readOptional(join(cwd, "package.json"));
  if (!packageText.ok) {
    return packageText;
  }
  if (packageText.value === undefined) {
    return err(`No package.json in ${cwd}. Run strict-ts init from the project root.`);
  }
  const pkg = safeJsonParse(packageText.value);
  if (!pkg.ok || !isRecord(pkg.value)) {
    return err("package.json is not a valid JSON object");
  }

  const tsconfigText = await readOptional(join(cwd, "tsconfig.json"));
  const extensionsText = await readOptional(join(cwd, ".vscode/extensions.json"));
  const settingsText = await readOptional(join(cwd, ".vscode/settings.json"));
  if (!tsconfigText.ok) {
    return tsconfigText;
  }
  if (!extensionsText.ok) {
    return extensionsText;
  }
  if (!settingsText.ok) {
    return settingsText;
  }

  const tsconfig = planTsconfig(tsconfigText.value);
  const packageJson = planPackageJson(packageText.value, pkg.value, options.packageSpec);
  const extensions = planVscodeExtensions(extensionsText.value);
  const eslintVersion = await projectEslintVersion(cwd, pkg.value);
  const suppressionsSupported = eslintVersion === undefined || supportsSuppressionsApi(eslintVersion);
  const settings = planVscodeSettings(settingsText.value, suppressionsSupported);
  if (!tsconfig.ok) {
    return tsconfig;
  }
  if (!packageJson.ok) {
    return packageJson;
  }
  if (!extensions.ok) {
    return extensions;
  }
  if (!settings.ok) {
    return settings;
  }

  const eslint = planEslint(await findEslintConfig(cwd), pkg.value["type"] === "module", options.force === true);
  const packageManager = await detectPackageManager(cwd);
  const agentsText = await readOptional(join(cwd, "AGENTS.md"));
  const claudeText = await readOptional(join(cwd, "CLAUDE.md"));
  if (!agentsText.ok) {
    return agentsText;
  }
  if (!claudeText.ok) {
    return claudeText;
  }
  const claude = planClaude(claudeText.value);
  const notes = [...packageJson.value.notes];
  if (!suppressionsSupported) {
    notes.push(
      `Applying bulk suppressions in the editor needs ESLint ${SUPPRESSIONS_API_VERSION} or later; this project uses ESLint ${eslintVersion}. The editor setting was not added.`,
    );
  }
  if (eslint.status === "skipped") {
    notes.push(`Add this to ${eslint.file}:\n\n${eslintTemplate()}`);
  }

  return ok({
    changes: [
      tsconfig.value,
      eslint,
      packageJson.value.change,
      planAgents(agentsText.value, packageManager),
      ...(claude === undefined ? [] : [claude]),
      extensions.value,
      settings.value,
    ],
    missingPeers: packageJson.value.missingPeers,
    packageManager,
    notes,
  });
}

export async function applyInit(cwd: string, report: InitReport): AsyncResult<void, FsError> {
  for (const change of report.changes) {
    if (change.content === undefined) {
      continue;
    }
    const path = join(cwd, change.file);
    if (change.file.startsWith(".vscode/")) {
      const dir = await ensureDir(join(cwd, ".vscode"));
      if (!dir.ok) {
        return dir;
      }
    }
    const written = await writeTextFile(path, change.content);
    if (!written.ok) {
      return written;
    }
  }
  return ok(undefined);
}

export function installCommand(packageManager: string, peers: readonly string[]): string {
  const add = packageManager === "npm" ? "npm install -D" : `${packageManager} add -D`;
  return peers.length === 0 ? `${packageManager} install` : `${add} ${peers.join(" ")}`;
}
