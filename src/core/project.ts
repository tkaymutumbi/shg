import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

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

export function readWebDir(projectRoot: string): string {
  const configFile = CONFIG_FILES.find((f) => existsSync(join(projectRoot, f)));
  if (!configFile) return "dist";

  try {
    const raw = readFileSync(join(projectRoot, configFile), "utf8");

    if (configFile.endsWith(".json")) {
      const parsed = JSON.parse(raw);
      return parsed.webDir ?? "dist";
    }

    const match = raw.match(/webDir\s*[:=]\s*["']([^"']+)["']/);
    return match ? match[1] : "dist";
  } catch {
    return "dist";
  }
}

export function webDirExists(projectRoot: string): boolean {
  const webDir = readWebDir(projectRoot);
  return existsSync(join(projectRoot, webDir));
}

export function hasValidAndroidSdk(): boolean {
  const sdkRoot = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  if (!sdkRoot) return false;

  const platformsDir = join(sdkRoot, "platforms");
  if (!existsSync(platformsDir)) return false;

  const hasPlatform = readdirSync(platformsDir).some((name) => name.startsWith("android-"));
  return hasPlatform;
}

export function findAndroidSdkRoot(): string | undefined {
  const env = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  if (env && existsSync(join(env, "platforms"))) return env;

  const candidates = [
    join(homedir(), "Android", "Sdk"),
    join(homedir(), "android", "sdk"),
    "/usr/lib/android-sdk",
    "/opt/android-sdk",
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "platforms"))) return candidate;
  }

  return undefined;
}
