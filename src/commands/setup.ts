import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import type { CommandContext, CommandResult } from "./types.js";

interface SetupStep {
  key: "install" | "init" | "update" | "add-android";
  label: string;
  cmd: string;
  args: string[];
}

const SETUP_STEPS: SetupStep[] = [
  {
    key: "install",
    label: "Install Capacitor",
    cmd: "bun",
    args: ["add", "@capacitor/core", "@capacitor/cli"],
  },
  {
    key: "init",
    label: "Capacitor Init",
    cmd: "bunx",
    args: ["cap", "init"],
  },
  {
    key: "update",
    label: "Capacitor Update",
    cmd: "bunx",
    args: ["cap", "update"],
  },
  {
    key: "add-android",
    label: "Add Android Platform",
    cmd: "bunx",
    args: ["cap", "add", "android"],
  },
];

export async function runSetup(context: CommandContext): Promise<CommandResult> {
  const selected = SETUP_STEPS.filter((step) => Boolean(context.flags[step.key]));
  const steps = selected.length > 0 ? selected : SETUP_STEPS;

  if (!context.projectRoot) {
    const onlyInstall = steps.every((step) => step.key === "install");
    if (!onlyInstall) {
      console.error(chalk.red("This setup command requires a Capacitor project root."));
      return { exitCode: 1 };
    }
  }

  for (const step of steps) {
    console.log(chalk.yellow(`Running setup step: ${step.label}`));
    const result = await runCommand(
      {
        label: step.label,
        cmd: step.cmd,
        args: step.args,
        cwd: context.projectRoot ?? process.cwd(),
      },
      { verbose: context.verbose, stdio: "inherit" },
    );

    if (!result.success) {
      console.error(chalk.red(`Failed during setup: ${step.label}`));
      return { exitCode: 1 };
    }
  }

  console.log(chalk.green("Setup complete."));
  return { exitCode: 0 };
}
