import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot, hasAndroidPlatform, readWebDir, hasValidAndroidSdk, findAndroidSdkRoot, hasConnectedDevice, getCapacitorDependencyMajorMismatch } from "../core/project.js";
import { ensureAdb, connectOverWifi, getLanIp } from "../core/android.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runDev(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Dev");
  if (!projectRoot) return { exitCode: 1 };

  const mismatch = getCapacitorDependencyMajorMismatch(projectRoot);
  if (mismatch) {
    console.error(chalk.red("Capacitor package major versions do not match."));
    console.log(chalk.yellow(`  ${Object.entries(mismatch.versions).map(([name, version]) => `${name}=${version}`).join(", ")}`));
    console.log(chalk.dim("  Fix: align Capacitor packages to the same major version, then run `bun install && bunx cap sync android`."));
    return { exitCode: 1 };
  }

  const wifi = Boolean(context.flags.wifi);
  let host = typeof context.flags.host === "string" ? context.flags.host : (wifi ? (getLanIp() ?? "0.0.0.0") : "localhost");
  const port = typeof context.flags.port === "string" ? context.flags.port : "5173";

  const adbOk = await ensureAdb();
  if (!adbOk) {
    console.log(chalk.dim("  Install platform-tools and ensure `adb` is on PATH."));
    console.log(chalk.dim("  https://developer.android.com/studio/releases/platform-tools"));
    return { exitCode: 1 };
  }

  if (!hasAndroidPlatform(projectRoot)) {
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

  const webDir = readWebDir(projectRoot);
  const webDirPath = join(projectRoot, webDir);
  const indexHtml = join(webDirPath, "index.html");

  if (!existsSync(indexHtml)) {
    if (context.flags["skip-build"]) {
      if (!existsSync(webDirPath)) {
        mkdirSync(webDirPath, { recursive: true });
      }
    } else {
      if (existsSync(webDirPath)) {
        console.log(chalk.yellow(`"${webDir}/index.html" not found. Running build...`));
      } else {
        console.log(chalk.yellow(`Web assets directory "${webDir}" not found. Running build...`));
      }
      const buildResult = await runCommand(
        { label: "bun run build", cmd: "bun", args: ["run", "build"], cwd: projectRoot },
        { verbose: context.verbose, stdio: "inherit" },
      );
      if (!buildResult.success || !existsSync(indexHtml)) {
        console.log(chalk.yellow(`Build did not produce "${webDir}/index.html". Create it or check your build config.`));
        console.log(chalk.dim(`  Expected: ${indexHtml}`));
        return { exitCode: 1 };
      }
    }
  }

  let usingWifi = wifi;

  if (usingWifi) {
    const wifiOk = await connectOverWifi();
    if (!wifiOk) return { exitCode: 1 };
  }

  if (!usingWifi) {
    const deviceAvailable = await hasConnectedDevice();
    if (!deviceAvailable) {
      console.error(chalk.red("\nNo Android device or emulator detected.\n"));

      const choice = await p.select({
        message: "How would you like to connect?",
        options: [
          { value: "wifi", label: "WiFi", hint: "Connect wirelessly over network" },
          { value: "usb", label: "USB", hint: "Connect via USB cable" },
          { value: "emulator", label: "Emulator", hint: "Start an Android emulator" },
          { value: "cancel", label: "Cancel", hint: "Exit" },
        ],
      });

      if (p.isCancel(choice) || choice === "cancel") {
        console.log(chalk.dim("\n  Run `shg dev --wifi` next time to skip this prompt."));
        return { exitCode: 1 };
      }

      if (choice === "usb") {
        console.log(chalk.yellow("  Connect your device via USB and ensure USB debugging is enabled."));
        console.log(chalk.dim("  Settings → Developer Options → USB Debugging"));
        console.log(chalk.dim("  Run `shg dev` again after connecting.\n"));
        return { exitCode: 1 };
      }

      if (choice === "emulator") {
        console.log(chalk.yellow("  Start an AVD from Android Studio, then run `shg dev` again."));
        console.log(chalk.dim("  Tools → Device Manager → Create Device\n"));
        return { exitCode: 1 };
      }

      if (choice === "wifi") {
        const wifiOk = await connectOverWifi();
        if (!wifiOk) return { exitCode: 1 };
        usingWifi = true;
      }

      const recheck = await hasConnectedDevice();
      if (!recheck) {
        console.error(chalk.red("Still no device detected after connection attempt."));
        return { exitCode: 1 };
      }
    }
  }

  if (usingWifi && !context.flags.host && (host === "localhost" || host === "0.0.0.0")) {
    host = getLanIp() ?? "0.0.0.0";
  }

  if (usingWifi) {
    console.log(chalk.cyan(`  Dev server will be accessible at http://${host}:${port} on your device\n`));
  }

  console.log(chalk.cyan("\nStarting live reload dev server + Android app\n"));

  const capResult = await runCommand(
    {
      label: "bunx cap run android --live-reload",
      cmd: "bunx",
      args: ["cap", "run", "android", "--live-reload", `--host=${host}`, `--port=${port}`],
      cwd: projectRoot,
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
