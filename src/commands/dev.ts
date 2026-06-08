import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { hasAndroidPlatform, readWebDir, hasValidAndroidSdk, findAndroidSdkRoot, hasConnectedDevice } from "../core/project.js";
import { ensureAdb, connectOverWifi, getLanIp } from "../core/android.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runDev(context: CommandContext): Promise<CommandResult> {
  if (!context.projectRoot) {
    console.error(chalk.red("Dev command requires a Capacitor project root."));
    return { exitCode: 1 };
  }

  const wifi = Boolean(context.flags.wifi);
  const host = typeof context.flags.host === "string" ? context.flags.host : (wifi ? getLanIp() : "localhost");
  const port = typeof context.flags.port === "string" ? context.flags.port : "5173";

  const adbOk = await ensureAdb();
  if (!adbOk) {
    console.log(chalk.dim("  Install platform-tools and ensure `adb` is on PATH."));
    console.log(chalk.dim("  https://developer.android.com/studio/releases/platform-tools"));
    return { exitCode: 1 };
  }

  if (!hasAndroidPlatform(context.projectRoot)) {
    console.error(chalk.red("Android platform not found."));
    console.log(chalk.yellow("  Run: shg setup --add-android"));
    return { exitCode: 1 };
  }

  const sdkRoot = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  if (!sdkRoot || !hasValidAndroidSdk()) {
    const found = findAndroidSdkRoot();
    if (found) {
      console.log(chalk.cyan(`Android SDK detected at: ${found}`));
    } else {
      console.error(chalk.red("No valid Android SDK found."));
      console.log(chalk.yellow("  Install Android Studio, then set ANDROID_SDK_ROOT to your SDK path."));
      return { exitCode: 1 };
    }
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

  if (wifi) {
    const wifiOk = await connectOverWifi();
    if (!wifiOk) return { exitCode: 1 };
    console.log(chalk.cyan(`  Dev server will be accessible at http://${host}:${port} on your device\n`));
  }

  const deviceAvailable = await hasConnectedDevice();
  if (!deviceAvailable) {
    console.error(chalk.red("No Android device or emulator detected."));
    console.log(chalk.yellow("  USB: Connect a device via USB."));
    console.log(chalk.yellow("  WiFi: Re-run with --wifi flag (USB connect required first time)."));
    console.log(chalk.yellow("  Emulator: Start an AVD from Android Studio."));
    console.log(chalk.dim("  Check: adb devices -l"));
    return { exitCode: 1 };
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

  if (!capResult.success) {
    console.error(chalk.red("\nnative-run failed. Common causes:"));
    console.log(chalk.yellow("  - No device or emulator connected (check: adb devices)"));
    console.log(chalk.yellow("  - Android SDK not fully installed"));
    console.log(chalk.yellow("  - App build/install error on device"));
    console.log(chalk.dim("  Run: shg doctor --fix"));
  }

  return { exitCode: capResult.success ? 0 : 1 };
}
