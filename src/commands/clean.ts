import { existsSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import chalk from "chalk";
import { requireProjectRoot, emitJson, readWebDir } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

interface CleanTarget {
  label: string;
  path: string;
}

export function getCleanTargets(projectRoot: string): CleanTarget[] {
  const targets = [
    { label: "Android build", path: join(projectRoot, "android", "build") },
    { label: "Android app build", path: join(projectRoot, "android", "app", "build") },
    { label: "Android gradle cache", path: join(projectRoot, "android", ".gradle") },
    { label: "Node cache", path: join(projectRoot, "node_modules", ".cache") },
  ];
  const webDir = readWebDir(projectRoot);
  const webPath = resolve(projectRoot, webDir);
  const relativeWebPath = relative(projectRoot, webPath);
  const isInsideProject = relativeWebPath && !relativeWebPath.startsWith("..") && !isAbsolute(relativeWebPath);
  const topLevelDir = relativeWebPath.split(/[\\/]/)[0];
  if (isInsideProject && !["src", "public", "web", "android", "ios", "node_modules", "assets", ".git"].includes(topLevelDir)) {
    targets.push({ label: `Capacitor web assets (${webDir})`, path: webPath });
  }
  return targets;
}

export async function runClean(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Clean");
  if (!projectRoot) return { exitCode: 1 };

  const targets = getCleanTargets(projectRoot);
  let cleaned = 0;
  let failed = 0;
  const json = Boolean(context.json || context.flags.json);

  if (!json) console.log(chalk.cyan("\nCleaning project artifacts...\n"));

  for (const target of targets) {
    if (!existsSync(target.path)) {
      if (context.verbose && !json) console.log(chalk.dim(`  - ${target.label}: not found, skipping`));
      continue;
    }

    if (!json) console.log(chalk.yellow(`  Cleaning ${target.label}...`));
    try {
      rmSync(target.path, { recursive: true, force: true });
      cleaned++;
    } catch {
      failed++;
      if (!json) console.error(chalk.red(`  Failed to clean ${target.label}`));
    }
  }

  if (context.json || context.flags.json) {
    emitJson({ cleaned, failed, targets: targets.length, success: failed === 0 });
    return { exitCode: failed === 0 ? 0 : 1 };
  }

  console.log(chalk.green(`\nCleaned ${cleaned}/${targets.length} targets.`));
  return { exitCode: failed === 0 ? 0 : 1 };
}
