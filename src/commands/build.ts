import chalk from "chalk";
import { runCommand } from "../core/executor.js";
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
