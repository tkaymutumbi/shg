import chalk from "chalk";
import { join } from "node:path";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot, webDirExists, emitJson } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getGradleBuildTasks(variant: string, flavor: string | undefined, artifacts: Array<"apk" | "aab">): string[] {
  return artifacts.map((artifact) => {
    const prefix = artifact === "aab" ? "bundle" : "assemble";
    return flavor
      ? `${prefix}${capitalize(flavor)}${capitalize(variant)}`
      : `${prefix}${capitalize(variant)}`;
  });
}

export async function runBuild(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Build");
  if (!projectRoot) return { exitCode: 1 };
  const silent = Boolean(context.flags.__silent);
  const json = !silent && Boolean(context.json || context.flags.json);

  const release = Boolean(context.flags.release);
  const variantFlag = typeof context.flags.variant === "string" ? context.flags.variant : undefined;
  if (release && variantFlag && variantFlag !== "release") {
    const message = 'Conflicting flags: --release cannot be combined with --variant values other than "release".';
    if (json) emitJson({ success: false, error: message });
    else if (!silent) console.error(chalk.red(message));
    return { exitCode: 1 };
  }

  const variant = variantFlag ?? (release ? "release" : "debug");
  const flavor = typeof context.flags.flavor === "string" ? context.flags.flavor : undefined;
  const artifactKinds: Array<"apk" | "aab"> = context.flags.both || (context.flags.aab && context.flags.apk)
    ? ["apk", "aab"]
    : context.flags.aab
      ? ["aab"]
      : ["apk"];

  if (!context.flags["no-sync"]) {
    if (!webDirExists(projectRoot)) {
      if (!json && !silent) console.log(chalk.yellow("Web assets not found. Running web build..."));
      const webBuild = await runCommand(
        { label: "bun run build", cmd: "bun", args: ["run", "build"], cwd: projectRoot },
        { verbose: context.verbose && !json && !silent, stdio: json || silent ? "pipe" : "inherit" },
      );
      if (!webBuild.success) {
        if (json) emitJson({ success: false, step: "web-build", error: webBuild.stderr || webBuild.errorMessage });
        else if (!silent) console.error(chalk.red("Web build failed."));
        return { exitCode: 1 };
      }
    }

    if (!json && !silent) console.log(chalk.yellow("Syncing web assets to Android project..."));
    const syncResult = await runCommand(
      { label: "bunx cap sync android", cmd: "bunx", args: ["cap", "sync", "android"], cwd: projectRoot },
      { verbose: context.verbose && !json && !silent, stdio: json || silent ? "pipe" : "inherit" },
    );
    if (!syncResult.success) {
      if (json) emitJson({ success: false, step: "sync", error: syncResult.stderr || syncResult.errorMessage });
      else if (!silent) console.error(chalk.red("Capacitor sync failed."));
      return { exitCode: 1 };
    }
  }

  const androidDir = join(projectRoot, "android");
  const gradlew = join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
  const tasks = getGradleBuildTasks(variant, flavor, artifactKinds);
  for (const [index, artifact] of artifactKinds.entries()) {
    const task = tasks[index];

    if (!json && !silent) console.log(chalk.cyan(`\nBuilding Android ${variant} ${artifact.toUpperCase()}...\n`));

    const result = await runCommand(
      { label: `${gradlew} ${task}`, cmd: gradlew, args: [task], cwd: androidDir },
      { verbose: context.verbose && !json && !silent, stdio: json || silent ? "pipe" : "inherit" },
    );

    if (!result.success) {
      if (json) emitJson({ success: false, step: "gradle", task, error: result.stderr || result.errorMessage });
      else if (!silent) console.error(chalk.red("Build failed."));
      return { exitCode: 1 };
    }
  }

  if (!json && !silent) console.log(chalk.green(`Build complete (${variant}).`));

  if (json) {
    emitJson({ variant, flavor, artifacts: artifactKinds, success: true });
  }

  return { exitCode: 0 };
}
