import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonFile, writeJsonFile } from "./fsjson.js";

export interface ShgConfig {
  defaultFlow: "deployAll";
  defaultDeviceId: string;
  defaultVariant: string;
  defaultFlavor: string;
  autoSyncBeforeRun: boolean;
  doctor: {
    autoRunBeforeDeploy: boolean;
    allowSafeFixes: boolean;
  };
  output: {
    verbose: boolean;
    json: boolean;
  };
}

export const DEFAULT_CONFIG: ShgConfig = {
  defaultFlow: "deployAll",
  defaultDeviceId: "",
  defaultVariant: "debug",
  defaultFlavor: "",
  autoSyncBeforeRun: true,
  doctor: {
    autoRunBeforeDeploy: true,
    allowSafeFixes: false,
  },
  output: {
    verbose: false,
    json: false,
  },
};

export function getGlobalConfigPath(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "shg", "config.json");
  }
  return join(homedir(), ".config", "shg", "config.json");
}

export function getLocalConfigPath(projectRoot: string): string {
  return join(projectRoot, ".shgrc.json");
}

export function mergeConfig(base: ShgConfig, override?: Partial<ShgConfig>): ShgConfig {
  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    doctor: {
      ...base.doctor,
      ...(override.doctor ?? {}),
    },
    output: {
      ...base.output,
      ...(override.output ?? {}),
    },
  };
}

export interface LoadedConfig {
  config: ShgConfig;
  globalPath: string;
  localPath?: string;
}

export function loadMergedConfig(projectRoot?: string): LoadedConfig {
  const globalPath = getGlobalConfigPath();
  const globalConfig = readJsonFile<Partial<ShgConfig>>(globalPath);

  let config = mergeConfig(DEFAULT_CONFIG, globalConfig);
  let localPath: string | undefined;

  if (projectRoot) {
    localPath = getLocalConfigPath(projectRoot);
    if (existsSync(localPath)) {
      const localConfig = readJsonFile<Partial<ShgConfig>>(localPath);
      config = mergeConfig(config, localConfig);
    }
  }

  return { config, globalPath, localPath };
}

export function writeGlobalConfig(config: ShgConfig): string {
  const path = getGlobalConfigPath();
  writeJsonFile(path, config);
  return path;
}

export function writeLocalConfig(projectRoot: string, config: ShgConfig): string {
  const path = getLocalConfigPath(projectRoot);
  writeJsonFile(path, config);
  return path;
}
