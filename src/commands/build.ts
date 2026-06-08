import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { webDirExists } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function runBuild(context: CommandContext): Promise<CommandResult> {
  if (!context.projectRoot) {
    console.error(chalk.red("Build command requires a Capacitor project root."));
    return { exitCode: 1 };
  }

  const release = Boolean(context.flags.release);
  const variant = release ? "release" : (typeof context.flags.variant === "string" ? context.flags.variant : "debug");
  const flavor = typeof context.flags.flavor === "string" ? context.flags.flavor : undefined;

  if (!context.flags["no-sync"]) {
    if (!webDirExists(context.projectRoot)) {
      console.log(chalk.yellow("Web assets not found. Running web build..."));
      const webBuild = await runCommand(
        { label: "bun run build", cmd: "bun", args: ["run", "build"], cwd: context.projectRoot },
        { verbose: context.verbose, stdio: "inherit" },
      );
      if (!webBuild.success) {
        console.error(chalk.red("Web build failed."));
        return { exitCode: 1 };
      }
    }

    console.log(chalk.yellow("Syncing web assets to Android project..."));
    const syncResult = await runCommand(
      { label: "bunx cap sync android", cmd: "bunx", args: ["cap", "sync", "android"], cwd: context.projectRoot },
      { verbose: context.verbose, stdio: "inherit" },
    );
    if (!syncResult.success) {
      console.error(chalk.red("Capacitor sync failed."));
      return { exitCode: 1 };
    }
  }

  const androidDir = `${context.projectRoot}/android`;
  const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  const task = flavor ? `${flavor}${capitalize(variant)}` : `assemble${capitalize(variant)}`;

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
    console.log(JSON.stringify({ variant, flavor, success: true }, null, 2));
  }

  return { exitCode: 0 };
}
