import chalk from "chalk";
import {
  DEFAULT_CONFIG,
  loadMergedConfig,
  getGlobalConfigPath,
  getLocalConfigPath,
  type ShgConfig,
} from "../core/config.js";
import { readJsonFile, writeJsonFile } from "../core/fsjson.js";
import type { CommandContext, CommandResult } from "./types.js";

export function setDeepValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  if (keys.some((key) => !key || key === "__proto__" || key === "prototype" || key === "constructor")) {
    throw new Error("Unsafe configuration key path.");
  }
  let current: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

const CONFIG_VALUE_TYPES: Record<string, "string" | "boolean"> = {
  defaultFlow: "string",
  defaultDeviceId: "string",
  defaultVariant: "string",
  defaultFlavor: "string",
  autoSyncBeforeRun: "boolean",
  "doctor.autoRunBeforeDeploy": "boolean",
  "doctor.allowSafeFixes": "boolean",
  "output.verbose": "boolean",
  "output.json": "boolean",
};

export function parseValue(raw: string): string | boolean | number {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && raw.trim() !== "") return numeric;
  return raw;
}

export async function runConfig(context: CommandContext, rest: string[]): Promise<CommandResult> {
  const subcommand = rest[0] ?? "list";
  const scope = context.flags.global ? "global" : "local";

  if (subcommand === "path") {
    const loaded = loadMergedConfig(context.projectRoot);
    if (scope === "global") {
      console.log(loaded.globalPath);
      return { exitCode: 0 };
    }
    if (!loaded.localPath) {
      console.error(chalk.red("Local config path unavailable outside a project."));
      return { exitCode: 1 };
    }
    console.log(loaded.localPath);
    return { exitCode: 0 };
  }

  if (subcommand === "list") {
    console.log(JSON.stringify(context.config, null, 2));
    return { exitCode: 0 };
  }

  if (subcommand === "get") {
    const key = rest[1];
    if (!key) {
      console.error(chalk.red("Usage: shg config get <key.path>"));
      return { exitCode: 2 };
    }

    const value = key.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, context.config as unknown);

    if (value === undefined) {
      console.error(chalk.red(`Config key not found: ${key}`));
      return { exitCode: 1 };
    }

    if (typeof value === "object") {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(String(value));
    }
    return { exitCode: 0 };
  }

  if (subcommand === "set") {
    const key = rest[1];
    const rawValue = rest[2];
    if (!key || rawValue === undefined) {
      console.error(chalk.red("Usage: shg config set <key.path> <value> [--global]"));
      return { exitCode: 2 };
    }

    let scopeConfig: Record<string, unknown>;
    let configPath: string;

    if (scope === "global") {
      configPath = getGlobalConfigPath();
      scopeConfig = readJsonFile<Record<string, unknown>>(configPath) ?? {};
    } else {
      if (!context.projectRoot) {
        console.error(chalk.red("Local config set requires a Capacitor project."));
        return { exitCode: 1 };
      }
      configPath = getLocalConfigPath(context.projectRoot);
      scopeConfig = readJsonFile<Record<string, unknown>>(configPath) ?? {};
    }

    const expectedType = CONFIG_VALUE_TYPES[key];
    if (!expectedType) {
      console.error(chalk.red(`Unknown config key: ${key}`));
      return { exitCode: 2 };
    }
    const value = parseValue(rawValue);
    if (typeof value !== expectedType || (key === "defaultFlow" && value !== "deployAll")) {
      console.error(chalk.red(`Invalid value for ${key}; expected ${key === "defaultFlow" ? '"deployAll"' : expectedType}.`));
      return { exitCode: 2 };
    }
    setDeepValue(scopeConfig, key, value);
    writeJsonFile(configPath, scopeConfig);
    console.log(chalk.green(`Updated ${scope} config: ${configPath}`));
    return { exitCode: 0 };
  }

  console.error(chalk.red(`Unknown config subcommand: ${subcommand}`));
  return { exitCode: 2 };
}
