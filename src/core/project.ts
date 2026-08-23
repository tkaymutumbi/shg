import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import chalk from "chalk";
import { execaSync } from "execa";
import { runCommand } from "./executor.js";
import type { CommandContext } from "../commands/types.js";

export const CONFIG_FILES = ["capacitor.config.ts", "capacitor.config.js", "capacitor.config.json"];

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
  return readCapacitorConfigValue(projectRoot, "webDir") ?? "dist";
}

export function readAppId(projectRoot: string): string | undefined {
  return readCapacitorConfigValue(projectRoot, "appId");
}

function readCapacitorConfigValue(projectRoot: string, key: string): string | undefined {
  const configFile = CONFIG_FILES.find((f) => existsSync(join(projectRoot, f)));
  if (!configFile) return undefined;

  try {
    const raw = readFileSync(join(projectRoot, configFile), "utf8");

    if (configFile.endsWith(".json")) {
      const parsed = JSON.parse(raw);
      const value = parsed[key];
      return typeof value === "string" ? value : undefined;
    }

    const match = raw.match(new RegExp(`${key}\\s*[:=]\\s*['"]([^'"]+)['"]`));
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function webDirExists(projectRoot: string): boolean {
  const webDir = readWebDir(projectRoot);
  return existsSync(join(projectRoot, webDir));
}

function readPackageJson(projectRoot: string): Record<string, any> | undefined {
  const packageJsonPath = join(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) return undefined;

  try {
    return JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch {
    return undefined;
  }
}

function readDependencyVersion(pkg: Record<string, any>, name: string): string | undefined {
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  const value = deps[name] ?? devDeps[name];
  return typeof value === "string" ? value : undefined;
}

function parseMajor(version: string): number | undefined {
  const match = version.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

export function getCapacitorDependencyVersions(projectRoot: string): Record<string, string> {
  const pkg = readPackageJson(projectRoot);
  if (!pkg) return {};

  const names = ["@capacitor/core", "@capacitor/cli", "@capacitor/android", "@capacitor/ios"];
  return Object.fromEntries(
    names
      .map((name) => [name, readDependencyVersion(pkg, name)] as const)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export function getCapacitorDependencyMajorMismatch(projectRoot: string): { majors: number[]; versions: Record<string, string> } | undefined {
  const versions = getCapacitorDependencyVersions(projectRoot);
  const majors = Object.values(versions)
    .map(parseMajor)
    .filter((major): major is number => typeof major === "number");

  if (majors.length < 2) return undefined;
  return new Set(majors).size > 1 ? { majors: [...new Set(majors)].sort((a, b) => a - b), versions } : undefined;
}

export function readAndroidJavaTarget(projectRoot: string): number | undefined {
  const candidateFiles = [
    join(projectRoot, "android", "app", "capacitor.build.gradle"),
    join(projectRoot, "android", "app", "build.gradle"),
  ];

  for (const file of candidateFiles) {
    if (!existsSync(file)) continue;
    try {
      const raw = readFileSync(file, "utf8");
      const match = raw.match(/JavaVersion\.VERSION_(\d+)/);
      if (match) return Number.parseInt(match[1], 10);
    } catch {}
  }

  return undefined;
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

export function requireProjectRoot(context: CommandContext, commandName: string): string | undefined {
  if (!context.projectRoot) {
    const message = `${commandName} command requires a Capacitor project root.`;
    if (context.json || context.flags.json) emitJson({ success: false, error: message });
    else console.error(chalk.red(message));
    return undefined;
  }
  return context.projectRoot;
}

export function emitJson(data: Record<string, unknown>): void {
  console.log(JSON.stringify(data, null, 2));
}
