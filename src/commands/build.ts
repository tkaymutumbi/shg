import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot, webDirExists, emitJson } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function runBuild(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Build");
  if (!projectRoot) return { exitCode: 1 };

  const release = Boolean(context.flags.release);
  const variantFlag = typeof context.flags.variant === "string" ? context.flags.variant : undefined;
  if (release && variantFlag && variantFlag !== "release") {
    console.error(chalk.red('Conflicting flags: --release cannot be combined with --variant values other than "release".'));
    return { exitCode: 1 };
  }

  const variant = variantFlag ?? (release ? "release" : "debug");
  const flavor = typeof context.flags.flavor === "string" ? context.flags.flavor : undefined;

  if (!context.flags["no-sync"]) {
    if (!webDirExists(projectRoot)) {
      console.log(chalk.yellow("Web assets not found. Running web build..."));
      const webBuild = await runCommand(
        { label: "bun run build", cmd: "bun", args: ["run", "build"], cwd: projectRoot },
        { verbose: context.verbose, stdio: "inherit" },
      );
      if (!webBuild.success) {
        console.error(chalk.red("Web build failed."));
        return { exitCode: 1 };
      }
    }

    console.log(chalk.yellow("Syncing web assets to Android project..."));
    const syncResult = await runCommand(
      { label: "bunx cap sync android", cmd: "bunx", args: ["cap", "sync", "android"], cwd: projectRoot },
      { verbose: context.verbose, stdio: "inherit" },
    );
    if (!syncResult.success) {
      console.error(chalk.red("Capacitor sync failed."));
      return { exitCode: 1 };
    }
  }

  const androidDir = `${projectRoot}/android`;
  const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  const task = flavor
    ? `assemble${capitalize(flavor)}${capitalize(variant)}`
    : `assemble${capitalize(variant)}`;

  console.log(chalk.cyan(`\nBuilding Android ${variant} APK...\n`));

  const result = await runCommand(
    { label: `./gradlew ${task}`, cmd: gradlew, args: [task], cwd: androidDir },
    { verbose: context.verbose, stdio: "inherit" },
  );

  if (!result.success) {
    console.error(chalk.red("Build failed."));
    return { exitCode: 1 };
  }

  console.log(chalk.green(`Build complete (${variant}).`));

  if (context.json || context.flags.json) {
    emitJson({ variant, flavor, success: true });
  }

  return { exitCode: 0 };
}
