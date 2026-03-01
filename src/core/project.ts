import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const CONFIG_FILES = ["capacitor.config.ts", "capacitor.config.js", "capacitor.config.json"];

export function findProjectRoot(startDir: string = process.cwd()): string | undefined {
  let current = resolve(startDir);

  while (true) {
    const hasConfig = CONFIG_FILES.some((file) => existsSync(join(current, file)));
    if (hasConfig) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

export function hasAndroidPlatform(projectRoot: string): boolean {
  return existsSync(join(projectRoot, "android"));
}

export function isCapacitorProject(dir: string = process.cwd()): boolean {
  return Boolean(findProjectRoot(dir));
}
