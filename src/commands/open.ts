import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runOpen(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Open");
  if (!projectRoot) return { exitCode: 1 };

  const platform = typeof context.flags.platform === "string" ? context.flags.platform : "android";

  console.log(chalk.cyan(`Opening ${platform} project...`));

  const result = await runCommand(
    { label: `bunx cap open ${platform}`, cmd: "bunx", args: ["cap", "open", platform], cwd: projectRoot },
    { verbose: context.verbose, stdio: "inherit" },
  );

  return { exitCode: result.success ? 0 : 1 };
}
