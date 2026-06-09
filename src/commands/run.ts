import * as p from "@clack/prompts";
import { join } from "node:path";
import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { listAndroidDevices, connectOverWifi, loadWifiIp } from "../core/android.js";
import { readAppId } from "../core/project.js";
import { loadState, saveState } from "../core/state.js";
import type { CommandContext, CommandResult } from "./types.js";

export interface RunOptions {
  skipSync?: boolean;
}

function getStringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function resolveRunValues(context: CommandContext) {
  if (!context.projectRoot) {
    return {
      device: getStringFlag(context.flags, "device") ?? context.config.defaultDeviceId,
      variant: getStringFlag(context.flags, "variant") ?? context.config.defaultVariant,
      flavor: getStringFlag(context.flags, "flavor") ?? context.config.defaultFlavor,
    };
  }

  const state = loadState(context.projectRoot);
  return {
    device: getStringFlag(context.flags, "device") || context.config.defaultDeviceId || state.lastDeviceId,
    variant: getStringFlag(context.flags, "variant") || context.config.defaultVariant || state.lastVariant || "debug",
    flavor: getStringFlag(context.flags, "flavor") || context.config.defaultFlavor || state.lastFlavor || "",
  };
}

export async function runRun(context: CommandContext, options: RunOptions = {}): Promise<CommandResult> {
  if (!context.projectRoot) {
    console.error(chalk.red("Run command requires a Capacitor project root."));
    return { exitCode: 1 };
  }

  const { device, variant, flavor } = resolveRunValues(context);

  const devices = await listAndroidDevices();
  const deviceConnected = !device || devices.some((d) => d.id === device);
  if (!deviceConnected && devices.length === 0) {
    const savedIp = loadWifiIp();
    const shouldReconnect = await p.confirm({
      message: `No device connected${savedIp ? ` (last WiFi: ${savedIp})` : ""}. Try to connect wirelessly?`,
      initialValue: true,
    });
    if (shouldReconnect) {
      const ok = await connectOverWifi();
      if (!ok) {
        console.error(chalk.red("No device available. Connect a device and retry."));
        return { exitCode: 1 };
      }
    } else {
      console.error(chalk.red("No device available. Connect a device and retry."));
      return { exitCode: 1 };
    }
  } else if (!deviceConnected) {
    console.error(chalk.red(`Target device "${device}" not found.`));
    console.log(chalk.dim(`Available: ${devices.map((d) => d.id).join(", ") || "none"}`));
    return { exitCode: 1 };
  }

  if (!options.skipSync && context.config.autoSyncBeforeRun) {
      const syncResult = await runCommand(
        {
          label: "bunx cap sync android",
          cmd: "bunx",
          args: ["cap", "sync", "android"],
          cwd: context.projectRoot,
        },
        { verbose: context.verbose, stdio: "inherit" },
      );

    if (!syncResult.success) {
      return { exitCode: 1 };
    }
  }

  const args = ["cap", "run", "android"];
  if (device) {
    args.push("--target", device);
  }
  if (variant) {
    args.push("--configuration", variant);
  }
  if (flavor) {
    args.push("--flavor", flavor);
  }

  const result = await runCommand(
    {
      label: "bunx cap run android",
      cmd: "bunx",
      args,
      cwd: context.projectRoot,
    },
    { verbose: context.verbose, stdio: "inherit" },
  );

  if (!result.success) {
    const isWifiDevice = device && device.includes(":");
    if (isWifiDevice) {
      const deviceCheck = await runCommand(
        { label: "adb devices", cmd: "adb", args: ["devices", "-l"] },
        { stdio: "pipe" },
      );
      const deviceGone = !deviceCheck.stdout.includes(device);

      if (deviceGone) {
        console.log(chalk.yellow("\nWiFi connection dropped during deploy. Reconnecting...\n"));
        const reconnected = await connectOverWifi();
        if (reconnected) {
          const apkPath = join(
            context.projectRoot!,
            "android", "app", "build", "outputs", "apk",
            variant === "release" ? "release" : "debug",
            `app-${variant === "release" ? "release" : "debug"}.apk`,
          );

          const appId = readAppId(context.projectRoot!);
          if (!appId) {
            console.error(chalk.red("Could not determine app package name from capacitor config."));
            return { exitCode: 1 };
          }

          console.log(chalk.dim("App was already installed. Re-launching...\n"));
          const relaunchResult = await runCommand(
            {
              label: "adb install and launch",
              cmd: "adb",
              args: ["-s", device, "shell", "monkey", "-p", appId, "1"],
              cwd: context.projectRoot,
            },
            { stdio: "inherit" },
          );

          if (relaunchResult.success) {
            console.log(chalk.green("App re-launched successfully after reconnection.\n"));
            saveState(context.projectRoot, { lastDeviceId: device, lastVariant: variant, lastFlavor: flavor });
            return { exitCode: 0 };
          }

          console.log(chalk.yellow("Could not re-launch. Trying re-install...\n"));
          const reinstallResult = await runCommand(
            {
              label: "adb install -r",
              cmd: "adb",
              args: ["-s", device, "install", "-r", "-d", apkPath],
              cwd: context.projectRoot,
            },
            { stdio: "inherit" },
          );

          if (reinstallResult.success) {
            console.log(chalk.green("App re-installed and will launch automatically.\n"));
            saveState(context.projectRoot, { lastDeviceId: device, lastVariant: variant, lastFlavor: flavor });
            return { exitCode: 0 };
          }
        }
      }
    }

    return { exitCode: 1 };
  }

  saveState(context.projectRoot, {
    lastDeviceId: device,
    lastVariant: variant,
    lastFlavor: flavor,
  });

  console.log(chalk.green("Run complete."));
  return { exitCode: 0 };
}
