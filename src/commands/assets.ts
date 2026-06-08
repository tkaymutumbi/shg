import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runAssets(context: CommandContext): Promise<CommandResult> {
  if (!context.projectRoot) {
    console.error(chalk.red("Assets command requires a Capacitor project root."));
    return { exitCode: 1 };
  }

  console.log(chalk.cyan("Generating app icons and splash screens..."));

  const result = await runCommand(
    { label: "bunx capacitor-assets generate", cmd: "bunx", args: ["capacitor-assets", "generate"], cwd: context.projectRoot },
    { verbose: context.verbose, stdio: "inherit" },
  );

  if (!result.success) {
    console.error(chalk.red("Asset generation failed. Is `npx capacitor-assets` available?"));
    return { exitCode: 1 };
  }

  console.log(chalk.green("Assets generated."));
  return { exitCode: 0 };
}
