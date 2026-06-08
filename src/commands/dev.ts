import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runDev(context: CommandContext): Promise<CommandResult> {
  if (!context.projectRoot) {
    console.error(chalk.red("Dev command requires a Capacitor project root."));
    return { exitCode: 1 };
  }

  const host = typeof context.flags.host === "string" ? context.flags.host : "localhost";
  const port = typeof context.flags.port === "string" ? context.flags.port : "5173";

  console.log(chalk.cyan("\nStarting live reload dev server + Android app\n"));

  const capResult = await runCommand(
    {
      label: "bunx cap run android --livereload",
      cmd: "bunx",
      args: ["cap", "run", "android", "--livereload", `--host=${host}`, `--port=${port}`],
      cwd: context.projectRoot,
    },
    { verbose: context.verbose, stdio: "inherit" },
  );

  return { exitCode: capResult.success ? 0 : 1 };
}
