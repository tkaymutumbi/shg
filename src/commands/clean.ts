import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot, emitJson } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

interface CleanTarget {
  label: string;
  path: string;
}

export function getCleanTargets(projectRoot: string): CleanTarget[] {
  return [
    { label: "Android build", path: join(projectRoot, "android", "build") },
    { label: "Android gradle cache", path: join(projectRoot, "android", ".gradle") },
    { label: "Node cache", path: join(projectRoot, "node_modules", ".cache") },
    { label: "Dist", path: join(projectRoot, "dist") },
    { label: "Capacitor web assets", path: join(projectRoot, "www") },
  ];
}

export async function runClean(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Clean");
  if (!projectRoot) return { exitCode: 1 };

  const targets = getCleanTargets(projectRoot);
  let cleaned = 0;

  console.log(chalk.cyan("\nCleaning project artifacts...\n"));

  for (const target of targets) {
    if (!existsSync(target.path)) {
      if (context.verbose) console.log(chalk.dim(`  - ${target.label}: not found, skipping`));
      continue;
    }

    console.log(chalk.yellow(`  Cleaning ${target.label}...`));
    const result = await runCommand(
      { label: `rm -rf ${target.path}`, cmd: "rm", args: ["-rf", target.path], cwd: projectRoot },
      { verbose: context.verbose, stdio: "pipe" },
    );

    if (result.success) {
      cleaned++;
    } else {
      console.error(chalk.red(`  Failed to clean ${target.label}`));
    }
  }

  if (context.json || context.flags.json) {
    emitJson({ cleaned, targets: targets.length });
    return { exitCode: 0 };
  }

  console.log(chalk.green(`\nCleaned ${cleaned}/${targets.length} targets.`));
  return { exitCode: 0 };
}
