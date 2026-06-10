import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot } from "../core/project.js";
import { runDoctor } from "./doctor.js";
import { runRun } from "./run.js";
import type { CommandContext, CommandResult } from "./types.js";

export function selectedDeploySteps(flags: Record<string, string | boolean>): Array<"build" | "sync" | "run"> {
  if (flags.all) {
    return ["build", "sync", "run"];
  }

  const steps: Array<"build" | "sync" | "run"> = [];
  if (flags.build) steps.push("build");
  if (flags.sync) steps.push("sync");
  if (flags.run) steps.push("run");

  return steps.length > 0 ? steps : ["build", "sync", "run"];
}

export async function runDeploy(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Deploy");
  if (!projectRoot) return { exitCode: 1 };

  const explicitFlags = ["all", "build", "sync", "run"].filter((key) => Boolean(context.flags[key]));
  if (context.flags.all && explicitFlags.length > 1) {
    console.error(chalk.red("Use either --all or individual deploy flags, not both."));
    return { exitCode: 2 };
  }

  if (context.config.doctor.autoRunBeforeDeploy) {
    const doctorResult = await runDoctor({ ...context, flags: {} });
    if (doctorResult.exitCode !== 0) {
      console.error(chalk.red("Doctor checks failed. Aborting deploy."));
      return doctorResult;
    }
  }

  const steps = selectedDeploySteps(context.flags);

  for (const step of steps) {
    if (step === "build") {
      const buildResult = await runCommand(
        {
          label: "bun run build",
          cmd: "bun",
          args: ["run", "build"],
          cwd: projectRoot,
        },
        { verbose: context.verbose, stdio: "inherit" },
      );
      if (!buildResult.success) {
        console.error(chalk.red("Deploy failed at build step."));
        return { exitCode: 1 };
      }
    }

    if (step === "sync") {
      const syncResult = await runCommand(
        {
          label: "bunx cap sync android",
          cmd: "bunx",
          args: ["cap", "sync", "android"],
          cwd: projectRoot,
        },
        { verbose: context.verbose, stdio: "inherit" },
      );
      if (!syncResult.success) {
        console.error(chalk.red("Deploy failed at sync step."));
        return { exitCode: 1 };
      }
    }

    if (step === "run") {
      const runResult = await runRun(context, { skipSync: true });
      if (runResult.exitCode !== 0) {
        console.error(chalk.red("\nDeploy failed at run step: could not install and launch the app."));
        console.log(chalk.yellow("Run `shg doctor` to check device connectivity, or `shg devices --help`."));
        return runResult;
      }
    }
  }

  console.log(chalk.green("Deploy flow complete."));
  return { exitCode: 0 };
}
