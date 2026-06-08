import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import type { CommandContext, CommandResult } from "./types.js";

type PluginSubcommand = "add" | "list" | "sync";

export async function runPlugin(context: CommandContext, rest: string[] = []): Promise<CommandResult> {
  if (!context.projectRoot) {
    console.error(chalk.red("Plugin command requires a Capacitor project root."));
    return { exitCode: 1 };
  }

  const subcommand = (rest[0] ?? "list") as PluginSubcommand;
  const name = rest[1];

  if (subcommand === "add") {
    if (!name) {
      console.error(chalk.red("Usage: shg plugin add <package-name>"));
      return { exitCode: 2 };
    }

    console.log(chalk.yellow(`Installing plugin: ${name}`));
    const npmResult = await runCommand(
      { label: `bun add ${name}`, cmd: "bun", args: ["add", name], cwd: context.projectRoot },
      { verbose: context.verbose, stdio: "inherit" },
    );
    if (!npmResult.success) return { exitCode: 1 };

    console.log(chalk.yellow("Syncing plugin..."));
    const syncResult = await runCommand(
      { label: "bunx cap sync android", cmd: "bunx", args: ["cap", "sync", "android"], cwd: context.projectRoot },
      { verbose: context.verbose, stdio: "inherit" },
    );
    if (!syncResult.success) return { exitCode: 1 };

    console.log(chalk.green(`Plugin ${name} added and synced.`));
    return { exitCode: 0 };
  }

  if (subcommand === "sync") {
    console.log(chalk.yellow("Syncing all plugins..."));
    const result = await runCommand(
      { label: "bunx cap sync android", cmd: "bunx", args: ["cap", "sync", "android"], cwd: context.projectRoot },
      { verbose: context.verbose, stdio: "inherit" },
    );
    if (!result.success) return { exitCode: 1 };
    console.log(chalk.green("Plugins synced."));
    return { exitCode: 0 };
  }

  if (context.json || context.flags.json) {
    const lsResult = await runCommand(
      { label: "bun pm ls", cmd: "bun", args: ["pm", "ls"], cwd: context.projectRoot },
      { stdio: "pipe" },
    );
    console.log(JSON.stringify({
      plugins: lsResult.success ? (lsResult.stdout || "").trim().split("\n") : [],
    }, null, 2));
    return { exitCode: 0 };
  }

  console.log(chalk.cyan("\nCapacitor Plugins\n"));
  const lsResult = await runCommand(
    { label: "bun pm ls", cmd: "bun", args: ["pm", "ls"], cwd: context.projectRoot },
    { stdio: "pipe" },
  );

  if (lsResult.success) {
    console.log(lsResult.stdout || "No @capacitor packages found.");
  } else {
    console.log(chalk.yellow("No Capacitor packages installed."));
  }

  return { exitCode: 0 };
}
