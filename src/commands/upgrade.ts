import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runUpgrade(context: CommandContext): Promise<CommandResult> {
  if (!context.projectRoot) {
    console.error(chalk.red("Upgrade command requires a Capacitor project root."));
    return { exitCode: 1 };
  }

  console.log(chalk.cyan("\nChecking Capacitor package versions...\n"));

  const lsResult = await runCommand(
    { label: "bun pm ls", cmd: "bun", args: ["pm", "ls"], cwd: context.projectRoot },
    { stdio: "pipe" },
  );

  if (lsResult.success && lsResult.stdout.trim()) {
    console.log(lsResult.stdout);
    console.log(chalk.dim("\nTo check for newer versions, visit https://www.npmjs.com/search?q=%40capacitor"));
  } else {
    console.log(chalk.green("All @capacitor packages are up to date."));
  }

  if (context.flags.run) {
    console.log(chalk.cyan("\nRunning npx cap upgrade...\n"));
    const upgradeResult = await runCommand(
      { label: "bunx cap upgrade", cmd: "bunx", args: ["cap", "upgrade"], cwd: context.projectRoot },
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
