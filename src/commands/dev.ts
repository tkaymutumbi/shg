import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { hasAndroidPlatform, readWebDir, webDirExists, hasValidAndroidSdk, findAndroidSdkRoot } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runDev(context: CommandContext): Promise<CommandResult> {
  if (!context.projectRoot) {
    console.error(chalk.red("Dev command requires a Capacitor project root."));
    return { exitCode: 1 };
  }

  const host = typeof context.flags.host === "string" ? context.flags.host : "localhost";
  const port = typeof context.flags.port === "string" ? context.flags.port : "5173";

  if (!hasAndroidPlatform(context.projectRoot)) {
    console.error(chalk.red("Android platform not found. Run `shg setup --add-android` first."));
    return { exitCode: 1 };
  }

  const webDir = readWebDir(context.projectRoot);
  const webDirPath = join(context.projectRoot, webDir);

  if (!existsSync(webDirPath)) {
    if (context.flags["skip-build"]) {
      console.log(chalk.yellow(`Web assets directory "${webDir}" not found. Creating empty directory...`));
      mkdirSync(webDirPath, { recursive: true });
    } else {
      console.log(chalk.yellow(`Web assets directory "${webDir}" not found. Running build...`));
      const buildResult = await runCommand(
        { label: "bun run build", cmd: "bun", args: ["run", "build"], cwd: context.projectRoot },
        { verbose: context.verbose, stdio: "inherit" },
      );
      if (!buildResult.success) {
        console.log(chalk.yellow(`Build failed. Creating empty "${webDir}" directory so Capacitor can still proceed...`));
        mkdirSync(webDirPath, { recursive: true });
      }
    }
  }

  if (!hasValidAndroidSdk()) {
    const found = findAndroidSdkRoot();
    if (found) {
      console.log(chalk.cyan(`Found Android SDK at ${found}. Set ANDROID_SDK_ROOT or ANDROID_HOME to this path.`));
    } else {
      console.error(chalk.red("No valid Android SDK found. Install Android Studio and set ANDROID_SDK_ROOT."));
      return { exitCode: 1 };
    }
  }

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
