import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type EnvFileLoad = {
  path: string;
  exists: boolean;
  loadedKeys: string[];
};

export type RuntimeEnvLoadResult = {
  files: EnvFileLoad[];
};

export type EnvFileWriteResult = {
  path: string;
  key: string;
  created: boolean;
  updated: boolean;
};

export function defaultConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const configRoot = env.XDG_CONFIG_HOME
    ? resolve(env.XDG_CONFIG_HOME)
    : join(homedir(), ".config");

  return join(configRoot, "surf-forecast", "config.env");
}

export function localEnvPath(cwd = process.cwd()): string {
  return resolve(cwd, ".env");
}

export function loadRuntimeEnv(input: {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  paths?: string[];
} = {}): RuntimeEnvLoadResult {
  const env = input.env ?? process.env;
  const paths = input.paths ?? [defaultConfigPath(env), localEnvPath(input.cwd)];
  const parsedFiles = paths.map((path) => loadEnvFile(path));
  const merged: Record<string, string> = Object.assign(
    {},
    ...parsedFiles.map((file) => file.values),
  );
  const existingKeys = new Set(Object.keys(env));

  for (const [key, value] of Object.entries(merged)) {
    if (!existingKeys.has(key)) {
      env[key] = value;
    }
  }

  return {
    files: parsedFiles.map(({ path, exists, values }) => ({
      path,
      exists,
      loadedKeys: Object.keys(values),
    })),
  };
}

export function resolveSetupTargetPath(
  target: string | undefined,
  input: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  } = {},
): string {
  if (!target || target === "user") {
    return defaultConfigPath(input.env ?? process.env);
  }

  if (target === "local") {
    return localEnvPath(input.cwd);
  }

  return resolve(input.cwd ?? process.cwd(), target);
}

export function writeEnvValue(
  path: string,
  key: string,
  value: string,
): EnvFileWriteResult {
  const existed = existsSync(path);
  const current = existed ? readFileSync(path, "utf8") : "";
  const line = `${key}=${JSON.stringify(value)}\n`;
  const keyPattern = new RegExp(`^(?:export\\s+)?${escapeRegExp(key)}=.*$`, "m");
  const updated = keyPattern.test(current);
  const next = updated
    ? ensureTrailingNewline(current.replace(keyPattern, line.trimEnd()))
    : `${ensureTrailingNewline(current)}${line}`;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next, { mode: 0o600 });

  return {
    path,
    key,
    created: !existed,
    updated,
  };
}

export function shellExportCommand(key: string, value: string): string {
  return `export ${key}=${shellQuote(value)}`;
}

function loadEnvFile(path: string): {
  path: string;
  exists: boolean;
  values: Record<string, string>;
} {
  if (!existsSync(path)) {
    return { path, exists: false, values: {} };
  }

  return {
    path,
    exists: true,
    values: parseEnvFile(readFileSync(path, "utf8")),
  };
}

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const assignment = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = assignment.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = assignment.slice(0, separatorIndex).trim();
    const rawValue = assignment.slice(separatorIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    values[key] = parseEnvValue(rawValue);
  }

  return values;
}

function parseEnvValue(rawValue: string): string {
  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    const quote = rawValue[0];
    const inner = rawValue.slice(1, -1);
    return quote === '"' ? unescapeDoubleQuotedValue(inner) : inner;
  }

  const commentStart = rawValue.indexOf(" #");
  return (commentStart >= 0 ? rawValue.slice(0, commentStart) : rawValue).trim();
}

function unescapeDoubleQuotedValue(value: string): string {
  return value.replace(/\\([nrt"\\])/g, (_, escaped: string) => {
    switch (escaped) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      default:
        return escaped;
    }
  });
}

function ensureTrailingNewline(value: string): string {
  return value && !value.endsWith("\n") ? `${value}\n` : value;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
