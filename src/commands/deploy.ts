import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot, emitJson } from "../core/project.js";
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
  const json = Boolean(context.json || context.flags.json);
  if (json && context.flags.fix) {
    emitJson({ success: false, error: "--json and --fix cannot be combined because fixes may require interactive input." });
    return { exitCode: 2 };
  }

  const explicitFlags = ["all", "build", "sync", "run"].filter((key) => Boolean(context.flags[key]));
  if (context.flags.all && explicitFlags.length > 1) {
    if (json) emitJson({ success: false, error: "Use either --all or individual deploy flags, not both." });
    else console.error(chalk.red("Use either --all or individual deploy flags, not both."));
    return { exitCode: 2 };
  }

  if (context.config.doctor.autoRunBeforeDeploy) {
    const doctorFlags: Record<string, string | boolean> = {};
    if (context.flags.verbose || context.verbose) doctorFlags.verbose = true;
    if (context.flags.fix) doctorFlags.fix = true;
    if (json) doctorFlags.__silent = true;

    const doctorResult = await runDoctor({ ...context, flags: doctorFlags });
    if (doctorResult.exitCode !== 0) {
      if (json) emitJson({ success: false, step: "doctor" });
      else console.error(chalk.red("Doctor checks failed. Aborting deploy."));
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
        { verbose: context.verbose && !json, stdio: json ? "pipe" : "inherit" },
      );
      if (!buildResult.success) {
        if (json) emitJson({ success: false, step: "build", error: buildResult.stderr || buildResult.errorMessage });
        else console.error(chalk.red("Deploy failed at build step."));
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
        { verbose: context.verbose && !json, stdio: json ? "pipe" : "inherit" },
      );
      if (!syncResult.success) {
        if (json) emitJson({ success: false, step: "sync", error: syncResult.stderr || syncResult.errorMessage });
        else console.error(chalk.red("Deploy failed at sync step."));
        return { exitCode: 1 };
      }
    }

    if (step === "run") {
      const runResult = await runRun(json
        ? { ...context, flags: { ...context.flags, __silent: true } }
        : context, { skipSync: true });
      if (runResult.exitCode !== 0) {
        if (json) emitJson({ success: false, step: "run", exitCode: runResult.exitCode });
        else {
          console.error(chalk.red("\nDeploy failed at run step: could not install and launch the app."));
          console.log(chalk.yellow("Run `shg doctor` to check device connectivity, or `shg devices --help`."));
        }
        return runResult;
      }
    }
  }

  if (json) emitJson({ success: true, steps });
  else console.log(chalk.green("Deploy flow complete."));
  return { exitCode: 0 };
}
