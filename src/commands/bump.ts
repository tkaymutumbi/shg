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
  const clean = input.replace(/^v/, "");
  const parts = clean.split(".");
  const major = parseInt(parts[0] ?? "1", 10);
  const minor = parseInt(parts[1] ?? "0", 10);
  const patch = parseInt(parts[2] ?? "0", 10);
  return {
    versionName: `${major}.${minor}.${patch}`,
    versionCode: major * 10000 + minor * 100 + patch,
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
    let content = readFileSync(path, "utf8");
    content = content.replace(/["']?version["']?\s*[:=]\s*["'][^"']+["']/, `"version": "${version.versionName}"`);
    content = content.replace(/["']?versionName["']?\s*[:=]\s*["'][^"']+["']/, `"versionName": "${version.versionName}"`);
    content = content.replace(/["']?versionCode["']?\s*[:=]\s*\d+/, `"versionCode": ${version.versionCode}`);
    writeFileSync(path, content, "utf8");
    return true;
  } catch {
    return false;
  }
}

function updateBuildGradle(path: string, version: VersionInfo): boolean {
  try {
    let content = readFileSync(path, "utf8");
    content = content.replace(/versionName\s+"[^"]+"/, `versionName "${version.versionName}"`);
    content = content.replace(/versionCode\s+\d+/, `versionCode ${version.versionCode}`);
    writeFileSync(path, content, "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function runBump(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Bump");
  if (!projectRoot) return { exitCode: 1 };

  const rawVersion = typeof context.flags.to === "string" ? context.flags.to : undefined;

  let version: VersionInfo;

  if (rawVersion) {
    version = parseVersion(rawVersion);
  } else {
    const capacitorConfig = CONFIG_FILES
      .map((f) => join(projectRoot, f))
      .find((f) => existsSync(f));

    if (!capacitorConfig) {
      console.error(chalk.red("No capacitor.config.* file found to read current version."));
      return { exitCode: 1 };
    }

    const current = readCurrentVersion(capacitorConfig);
    if (!current) {
      console.error(chalk.red("Could not parse current version from capacitor.config.*"));
      return { exitCode: 1 };
    }

    const parsed = parseVersion(current.versionName);
    version = {
      versionName: `${parsed.versionName}`,
      versionCode: current.versionCode + 1,
    };
  }

  console.log(chalk.cyan(`\nBumping version to ${version.versionName} (code: ${version.versionCode})\n`));

  let updated = false;

  for (const configFile of CONFIG_FILES) {
    const configPath = join(projectRoot, configFile);
    if (!existsSync(configPath)) continue;
    if (updateCapacitorConfig(configPath, version)) {
      console.log(chalk.green(`  Updated ${configFile}`));
      updated = true;
    }
  }

  const buildGradlePath = join(projectRoot, "android", "app", "build.gradle");
  if (updateBuildGradle(buildGradlePath, version)) {
    console.log(chalk.green(`  Updated android/app/build.gradle`));
    updated = true;
  }

  if (!updated) {
    console.error(chalk.red("No files were updated."));
    return { exitCode: 1 };
  }

  if (context.json || context.flags.json) {
    emitJson({ version: version.versionName, versionCode: version.versionCode });
  }

  console.log(chalk.green("\nVersion bump complete."));
  return { exitCode: 0 };
}
