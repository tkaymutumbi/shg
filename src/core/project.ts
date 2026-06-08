import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { execaSync } from "execa";
import { runCommand } from "./executor.js";

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

function which(cmd: string): string | undefined {
  try {
    const { stdout } = execaSync(
      process.platform === "win32" ? "where" : "which",
      [cmd],
      { reject: false },
    );
    return stdout?.split(/\r?\n/)[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function resolveSdkFromBinary(binary: string, pathSuffix: string): string | undefined {
  const binPath = which(binary);
  if (!binPath) return undefined;

  try {
    let real = realpathSync(binPath);
    const parts = real.split(sep);
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = parts.slice(0, i).join(sep);
      if (existsSync(join(candidate, pathSuffix))) {
        return candidate;
      }
    }
  } catch {}

  return undefined;
}

export function findAndroidSdkRoot(): string | undefined {
  const env = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  if (env && existsSync(join(env, "platforms"))) return env;

  const platform = process.platform;
  const home = homedir();
  const appData = process.env.LOCALAPPDATA ?? "";

  const candidates: string[] = [];

  if (platform === "darwin") {
    candidates.push(join(home, "Library", "Android", "sdk"));
  } else if (platform === "win32") {
    candidates.push(join(appData, "Android", "Sdk"));
    candidates.push(join(home, "AppData", "Local", "Android", "Sdk"));
  }

  candidates.push(
    join(home, "Android", "Sdk"),
    join(home, "android", "sdk"),
    "/usr/lib/android-sdk",
    "/opt/android-sdk",
    "/opt/android",
    "/usr/local/share/android-sdk",
  );

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "platforms"))) return candidate;
  }

  const fromSdkManager = resolveSdkFromBinary("sdkmanager", "platforms");
  if (fromSdkManager) return fromSdkManager;

  const fromAvdManager = resolveSdkFromBinary("avdmanager", "platforms");
  if (fromAvdManager) return fromAvdManager;

  const fromAdb = resolveSdkFromBinary("adb", "platforms");
  if (fromAdb) return fromAdb;

  return undefined;
}

export async function hasConnectedDevice(): Promise<boolean> {
  try {
    const result = await runCommand(
      { label: "adb devices", cmd: "adb", args: ["devices", "-l"] },
      { stdio: "pipe" },
    );
    if (!result.success) return false;
    const lines = result.stdout.split(/\r?\n/).filter((l) => l.trim() && !l.includes("List of"));
    return lines.some((l) => /\bdevice\b/.test(l));
  } catch {
    return false;
  }
}
