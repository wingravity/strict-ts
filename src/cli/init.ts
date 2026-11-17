import { join } from "node:path";
import { err, ok, type AsyncResult, type Result } from "../result.ts";
import { safeJsonParse, safeJsonStringify } from "../safe/json.ts";
import { ensureDir, readTextFile, writeTextFile, type FsError } from "../node/fs.ts";
import { asArray, isRecord, parseJsonc, setTopLevelProperty } from "./jsonc.ts";

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

function planVscodeSettings(text: string | undefined): Result<Change, string> {
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
  if (eslintOptions["applySuppressions"] !== true) {
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
  const settings = planVscodeSettings(settingsText.value);
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
  const notes = [...packageJson.value.notes];
  if (eslint.status === "skipped") {
    notes.push(`Add this to ${eslint.file}:\n\n${eslintTemplate()}`);
  }

  return ok({
    changes: [tsconfig.value, eslint, packageJson.value.change, extensions.value, settings.value],
    missingPeers: packageJson.value.missingPeers,
    packageManager: await detectPackageManager(cwd),
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
