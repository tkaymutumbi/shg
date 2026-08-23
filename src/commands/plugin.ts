import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot, emitJson } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

type PluginSubcommand = "add" | "list" | "sync";

export async function runPlugin(context: CommandContext, rest: string[] = []): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Plugin");
  if (!projectRoot) return { exitCode: 1 };

  const subcommand = (rest[0] ?? "list") as PluginSubcommand;
  const name = rest[1];

  if (!["add", "list", "sync"].includes(subcommand)) {
    console.error(chalk.red(`Unknown plugin subcommand: ${subcommand}`));
    return { exitCode: 2 };
  }

  if (subcommand === "add") {
    if (!name) {
      console.error(chalk.red("Usage: shg plugin add <package-name>"));
      return { exitCode: 2 };
    }

    console.log(chalk.yellow(`Installing plugin: ${name}`));
    const npmResult = await runCommand(
      { label: `bun add ${name}`, cmd: "bun", args: ["add", name], cwd: projectRoot },
      { verbose: context.verbose, stdio: "inherit" },
    );
    if (!npmResult.success) return { exitCode: 1 };

    console.log(chalk.yellow("Syncing plugin..."));
    const syncResult = await runCommand(
      { label: "bunx cap sync android", cmd: "bunx", args: ["cap", "sync", "android"], cwd: projectRoot },
      { verbose: context.verbose, stdio: "inherit" },
    );
    if (!syncResult.success) return { exitCode: 1 };

    console.log(chalk.green(`Plugin ${name} added and synced.`));
    return { exitCode: 0 };
  }

  if (subcommand === "sync") {
    console.log(chalk.yellow("Syncing all plugins..."));
    const result = await runCommand(
      { label: "bunx cap sync android", cmd: "bunx", args: ["cap", "sync", "android"], cwd: projectRoot },
      { verbose: context.verbose, stdio: "inherit" },
    );
    if (!result.success) return { exitCode: 1 };
    console.log(chalk.green("Plugins synced."));
    return { exitCode: 0 };
  }

  if (context.json || context.flags.json) {
    const lsResult = await runCommand(
      { label: "bun pm ls", cmd: "bun", args: ["pm", "ls"], cwd: projectRoot },
      { stdio: "pipe" },
    );
    emitJson({
      plugins: lsResult.success ? (lsResult.stdout || "").trim().split("\n") : [],
      success: lsResult.success,
    });
    return { exitCode: lsResult.success ? 0 : 1 };
  }

  console.log(chalk.cyan("\nCapacitor Plugins\n"));
  const lsResult = await runCommand(
    { label: "bun pm ls", cmd: "bun", args: ["pm", "ls"], cwd: projectRoot },
    { stdio: "pipe" },
  );

  if (lsResult.success) {
    console.log(lsResult.stdout || "No @capacitor packages found.");
  } else {
    console.log(chalk.yellow("No Capacitor packages installed."));
  }

  return { exitCode: lsResult.success ? 0 : 1 };
}
