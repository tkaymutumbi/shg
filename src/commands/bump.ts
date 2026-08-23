import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { requireProjectRoot, emitJson, CONFIG_FILES } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

interface VersionInfo {
  versionName: string;
  versionCode: number;
}

export function parseVersion(input: string): VersionInfo {
  const match = input.trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) throw new Error(`Invalid version "${input}". Expected MAJOR, MAJOR.MINOR, or MAJOR.MINOR.PATCH.`);
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2] ?? "0", 10);
  const patch = Number.parseInt(match[3] ?? "0", 10);
  if (minor > 99 || patch > 99) {
    throw new Error("Minor and patch versions must be between 0 and 99.");
  }
  const versionCode = major * 10000 + minor * 100 + patch;
  if (!Number.isSafeInteger(versionCode) || versionCode > 2_100_000_000) {
    throw new Error("Version is too large for an Android versionCode.");
  }
  return {
    versionName: `${major}.${minor}.${patch}`,
    versionCode,
  };
}

function readCurrentVersion(capacitorConfigPath: string): VersionInfo | null {
  try {
    const content = readFileSync(capacitorConfigPath, "utf8");
    const nameMatch = content.match(/versionName\s*[:=]\s*["']([^"']+)["']/);
    const codeMatch = content.match(/versionCode\s*[:=]\s*(\d+)/);
    if (nameMatch) {
      return {
        versionName: nameMatch[1],
        versionCode: codeMatch ? parseInt(codeMatch[1], 10) : 1,
      };
    }
    const simpleVersion = content.match(/version\s*[:=]\s*["']([^"']+)["']/);
    if (simpleVersion) {
      return parseVersion(simpleVersion[1]);
    }
  } catch {}
  return null;
}

function updateCapacitorConfig(path: string, version: VersionInfo): boolean {
  try {
    const original = readFileSync(path, "utf8");
    if (!path.endsWith(".json")) return false;
    const parsed = JSON.parse(original) as Record<string, unknown>;
    let changed = false;
    if ("version" in parsed) { parsed.version = version.versionName; changed = true; }
    if ("versionName" in parsed) { parsed.versionName = version.versionName; changed = true; }
    if ("versionCode" in parsed) { parsed.versionCode = version.versionCode; changed = true; }
    if (!changed) return false;
    writeFileSync(path, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

function updateBuildGradle(path: string, version: VersionInfo): boolean {
  try {
    const original = readFileSync(path, "utf8");
    let content = original;
    content = content.replace(/(versionName\s*(?:=\s*)?)["'][^"']+["']/, `$1"${version.versionName}"`);
    content = content.replace(/(versionCode\s*(?:=\s*)?)\d+/, `$1${version.versionCode}`);
    if (content === original) return false;
    writeFileSync(path, content, "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function runBump(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Bump");
  if (!projectRoot) return { exitCode: 1 };
  const json = Boolean(context.json || context.flags.json);

  const rawVersion = typeof context.flags.to === "string" ? context.flags.to : undefined;

  let version: VersionInfo;

  if (rawVersion) {
    try {
      version = parseVersion(rawVersion);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid version.";
      if (json) emitJson({ success: false, error: message });
      else console.error(chalk.red(message));
      return { exitCode: 2 };
    }
  } else {
    const capacitorConfig = CONFIG_FILES
      .map((f) => join(projectRoot, f))
      .find((f) => existsSync(f));

    if (!capacitorConfig) {
      const message = "No capacitor.config.* file found to read current version.";
      if (json) emitJson({ success: false, error: message });
      else console.error(chalk.red(message));
      return { exitCode: 1 };
    }

    const current = readCurrentVersion(capacitorConfig);
    if (!current) {
      const message = "Could not parse current version from capacitor.config.*";
      if (json) emitJson({ success: false, error: message });
      else console.error(chalk.red(message));
      return { exitCode: 1 };
    }

    let parsed: VersionInfo;
    try {
      parsed = parseVersion(current.versionName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid current version.";
      if (json) emitJson({ success: false, error: message });
      else console.error(chalk.red(message));
      return { exitCode: 1 };
    }
    version = {
      versionName: `${parsed.versionName}`,
      versionCode: current.versionCode + 1,
    };
  }

  if (!json) console.log(chalk.cyan(`\nBumping version to ${version.versionName} (code: ${version.versionCode})\n`));

  let updated = false;

  for (const configFile of CONFIG_FILES) {
    const configPath = join(projectRoot, configFile);
    if (!existsSync(configPath)) continue;
    if (updateCapacitorConfig(configPath, version)) {
      if (!json) console.log(chalk.green(`  Updated ${configFile}`));
      updated = true;
    }
  }

  for (const gradleFile of ["build.gradle", "build.gradle.kts"]) {
    const buildGradlePath = join(projectRoot, "android", "app", gradleFile);
    if (existsSync(buildGradlePath) && updateBuildGradle(buildGradlePath, version)) {
      if (!json) console.log(chalk.green(`  Updated android/app/${gradleFile}`));
      updated = true;
    }
  }

  if (!updated) {
    if (json) emitJson({ success: false, error: "No version fields were found in capacitor.config.json or Android Gradle files." });
    else console.error(chalk.red("No version fields were found in capacitor.config.json or Android Gradle files."));
    return { exitCode: 1 };
  }

  if (json) {
    emitJson({ version: version.versionName, versionCode: version.versionCode });
  } else {
    console.log(chalk.green("\nVersion bump complete."));
  }
  return { exitCode: 0 };
}
