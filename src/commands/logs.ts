import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { emitJson } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

export function getFilter(tag?: string, level?: string): string {
  if (tag) return `${tag}:${level ?? "D"}`;
  return `Capacitor:${level ?? "D"}`;
}

export async function runLogs(context: CommandContext): Promise<CommandResult> {
  const tag = typeof context.flags.tag === "string" ? context.flags.tag : undefined;
  const level = typeof context.flags.level === "string" ? context.flags.level : undefined;
  const filter = getFilter(tag, level);

  if (context.json || context.flags.json) {
    emitJson({ filter, tag, level });
    return { exitCode: 0 };
  }

  console.log(chalk.cyan(`\nTailing logcat with filter: ${filter}\n`));

  const result = await runCommand(
    {
      label: "adb logcat",
      cmd: "adb",
      args: ["logcat", "-s", filter],
      cwd: context.projectRoot ?? process.cwd(),
      timeout: 0,
    },
    { verbose: context.verbose, stdio: "inherit" },
  );

  return { exitCode: result.success ? 0 : 1 };
}
