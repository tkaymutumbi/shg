import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runUpgrade(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Upgrade");
  if (!projectRoot) return { exitCode: 1 };

  console.log(chalk.cyan("\nChecking Capacitor package versions...\n"));

  const outdatedResult = await runCommand(
    { label: "bun outdated", cmd: "bun", args: ["outdated"], cwd: projectRoot },
    { stdio: "pipe" },
  );

  if (!outdatedResult.success) {
    console.error(chalk.red(outdatedResult.stderr || outdatedResult.errorMessage || "Could not check package updates."));
    return { exitCode: 1 };
  }

  const capacitorLines = outdatedResult.stdout
    .split(/\r?\n/)
    .filter((line) => line.includes("@capacitor/"));
  if (capacitorLines.length > 0) {
    console.log(capacitorLines.join("\n"));
  } else {
    console.log(chalk.green("All declared @capacitor packages are up to date."));
  }

  if (context.flags.run) {
    console.log(chalk.cyan("\nRunning npx cap upgrade...\n"));
    const upgradeResult = await runCommand(
      { label: "bunx cap upgrade", cmd: "bunx", args: ["cap", "upgrade"], cwd: projectRoot },
      { stdio: "inherit" },
    );

    if (!upgradeResult.success) {
      console.error(chalk.red("Capacitor upgrade failed."));
      return { exitCode: 1 };
    }

    console.log(chalk.green("Capacitor upgraded."));
  } else {
    console.log(chalk.dim("\nTip: run `shg upgrade --run` to perform the upgrade."));
  }

  return { exitCode: 0 };
}
