import * as p from "@clack/prompts";
import chalk from "chalk";
import { runDeploy } from "./commands/deploy.js";
import { runSetup } from "./commands/setup.js";
import type { CommandContext } from "./commands/types.js";

export async function runInteractive(context: CommandContext): Promise<number> {
  p.intro(chalk.bgCyan(chalk.black(" SHG CLI Interactive ")));

  const category = await p.select({
    message: "What do you want to do?",
    options: [
      { value: "deploy", label: "Build & Deploy", hint: "smart deploy pipeline" },
      { value: "setup", label: "Capacitor Setup", hint: "install/init/update/add android" },
    ],
  });

  if (p.isCancel(category)) {
    p.cancel("Cancelled.");
    return 130;
  }

  if (category === "deploy") {
    const choice = await p.select({
      message: "Pick deploy flow:",
      options: [
        { value: "all", label: "Run ALL (build -> sync -> run)" },
        { value: "build", label: "Build only" },
        { value: "sync", label: "Sync only" },
        { value: "run", label: "Run only" },
      ],
    });

    if (p.isCancel(choice)) {
      p.cancel("Cancelled.");
      return 130;
    }

    const flags: Record<string, string | boolean> = { [choice as string]: true };
    const result = await runDeploy({ ...context, flags });
    p.outro(result.exitCode === 0 ? chalk.cyan("SHG done.") : chalk.red("SHG ended with errors."));
    return result.exitCode;
  }

  const choice = await p.multiselect({
    message: "Pick setup steps:",
    options: [
      { value: "install", label: "Install Capacitor dependencies" },
      { value: "init", label: "Capacitor init" },
      { value: "update", label: "Capacitor update" },
      { value: "add-android", label: "Add Android platform" },
    ],
    required: false,
  });

  if (p.isCancel(choice)) {
    p.cancel("Cancelled.");
    return 130;
  }

  const flags: Record<string, string | boolean> = {};
  for (const item of choice as string[]) {
    flags[item] = true;
  }

  const result = await runSetup({ ...context, flags });
  p.outro(result.exitCode === 0 ? chalk.cyan("SHG done.") : chalk.red("SHG ended with errors."));
  return result.exitCode;
}
