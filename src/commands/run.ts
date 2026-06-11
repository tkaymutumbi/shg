import * as p from "@clack/prompts";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { listAndroidDevices, connectOverWifi, loadWifiIp } from "../core/android.js";
import { requireProjectRoot, readAppId } from "../core/project.js";
import { loadState, saveState } from "../core/state.js";
import type { CommandContext, CommandResult } from "./types.js";

export interface RunOptions {
  skipSync?: boolean;
}

export function getStringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function resolveRunValues(projectRoot: string, context: CommandContext) {
  const state = loadState(projectRoot);
  return {
    device: getStringFlag(context.flags, "device") || context.config.defaultDeviceId || state.lastDeviceId,
    variant: getStringFlag(context.flags, "variant") || context.config.defaultVariant || state.lastVariant || "debug",
    flavor: getStringFlag(context.flags, "flavor") || context.config.defaultFlavor || state.lastFlavor || "",
  };
}

function normalizeActivityName(appId: string, activityName: string): string {
  if (activityName.startsWith(".")) return `${appId}${activityName}`;
  if (!activityName.includes(".")) return `${appId}.${activityName}`;
  return activityName;
}

function readLauncherComponent(projectRoot: string): string | undefined {
  const manifestPath = join(projectRoot, "android", "app", "src", "main", "AndroidManifest.xml");
  if (!existsSync(manifestPath)) return undefined;

  const appId = readAppId(projectRoot);
  if (!appId) return undefined;

  const manifest = readFileSync(manifestPath, "utf8");
  const launcherBlock = manifest.match(/<(activity|activity-alias)\b[\s\S]*?<intent-filter>[\s\S]*?android\.intent\.action\.MAIN[\s\S]*?android\.intent\.category\.LAUNCHER[\s\S]*?<\/intent-filter>[\s\S]*?<\/\1>/);
  const activityName = launcherBlock?.[0].match(/android:name\s*=\s*["']([^"']+)["']/)?.[1];
  if (!activityName) return undefined;

  return `${appId}/${normalizeActivityName(appId, activityName)}`;
}

function findBuiltApk(projectRoot: string, variant: string, flavor: string): string | undefined {
  const apkRoot = join(projectRoot, "android", "app", "build", "outputs", "apk");
  if (!existsSync(apkRoot)) return undefined;

  const files: string[] = [];
  const stack = [apkRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".apk")) {
        files.push(fullPath);
      }
    }
  }

  const normalizedFlavor = flavor.toLowerCase();
  const normalizedVariant = variant.toLowerCase();
  const matches = files.filter((file) => {
    const normalizedPath = file.toLowerCase();
    return normalizedPath.includes(normalizedVariant)
      && (!normalizedFlavor || normalizedPath.includes(normalizedFlavor));
  });

  return matches.sort((a, b) => b.length - a.length)[0] ?? files.sort((a, b) => b.length - a.length)[0];
}

function formatDeviceList(devices: { id: string; status: string; model?: string }[]): string {
  return devices.length > 0
    ? devices.map((d) => `${d.id} (${d.status}${d.model ? `, ${d.model}` : ""})`).join(", ")
    : "none";
}

export async function runRun(context: CommandContext, options: RunOptions = {}): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Run");
  if (!projectRoot) return { exitCode: 1 };

  const { device, variant, flavor } = resolveRunValues(projectRoot, context);

  let devices = await listAndroidDevices();
  let readyDevices = devices.filter((d) => d.status === "device");
  let resolvedTarget = device;

  const requestedDeviceConnected = resolvedTarget
    ? readyDevices.some((d) => d.id === resolvedTarget)
    : false;

  if (resolvedTarget && !requestedDeviceConnected) {
    if (readyDevices.length === 0) {
      const savedIp = loadWifiIp();
      const shouldReconnect = await p.confirm({
        message: `Target device "${resolvedTarget}" is not connected${savedIp ? ` (last WiFi: ${savedIp})` : ""}. Try WiFi reconnect?`,
        initialValue: true,
      });

      if (shouldReconnect) {
        const ok = await connectOverWifi();
        if (ok) {
          devices = await listAndroidDevices();
          readyDevices = devices.filter((d) => d.status === "device");
        }
      }
    }

    if (!readyDevices.some((d) => d.id === resolvedTarget)) {
      console.error(chalk.red(`Target device "${resolvedTarget}" not found.`));
      console.log(chalk.dim(`Available: ${formatDeviceList(devices)}`));
      return { exitCode: 1 };
    }
  }

  if (!resolvedTarget && readyDevices.length === 0) {
    const savedIp = loadWifiIp();
    const shouldReconnect = await p.confirm({
      message: `No ready Android device found${savedIp ? ` (last WiFi: ${savedIp})` : ""}. Try to connect over WiFi?`,
      initialValue: true,
    });

    if (shouldReconnect) {
      const ok = await connectOverWifi();
      if (ok) {
        devices = await listAndroidDevices();
        readyDevices = devices.filter((d) => d.status === "device");
      }
    }

    if (readyDevices.length === 0) {
      console.error(chalk.red("No Android device is ready for deployment."));
      if (devices.length > 0) {
        console.log(chalk.dim(`ADB sees: ${formatDeviceList(devices)}`));
        console.log(chalk.yellow("Tip: authorize the phone on-device, reconnect USB, or run `adb connect <phone-ip>:5555`."));
      } else {
        console.log(chalk.yellow("Tip: connect a phone with USB debugging enabled, or use WiFi ADB with `adb connect <phone-ip>:5555`."));
      }
      return { exitCode: 1 };
    }
  }

  if (!resolvedTarget && readyDevices.length === 1) {
    resolvedTarget = readyDevices[0].id;
  }

  if (!options.skipSync && context.config.autoSyncBeforeRun) {
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
      return { exitCode: 1 };
    }
  }

  const args = ["cap", "run", "android"];
  if (resolvedTarget) {
    args.push("--target", resolvedTarget);
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
      cwd: projectRoot,
    },
    { verbose: context.verbose, stdio: "inherit" },
  );

  if (!result.success) {
    const wifiTarget = resolvedTarget?.includes(":") ? resolvedTarget : undefined;
    if (wifiTarget) {
      const deviceCheck = await runCommand(
        { label: "adb devices", cmd: "adb", args: ["devices", "-l"] },
        { stdio: "pipe" },
      );
      const deviceGone = !deviceCheck.stdout.includes(wifiTarget);

      if (deviceGone) {
        console.log(chalk.yellow("\nWiFi connection dropped during deploy. Reconnecting...\n"));
        const reconnected = await connectOverWifi();
        if (reconnected) {
          const launcherComponent = readLauncherComponent(projectRoot);
          if (launcherComponent) {
            console.log(chalk.dim("App was already installed. Re-launching...\n"));
            const relaunchResult = await runCommand(
              {
                label: "adb shell am start",
                cmd: "adb",
                args: ["-s", wifiTarget, "shell", "am", "start", "-n", launcherComponent],
                cwd: projectRoot,
              },
              { stdio: "inherit" },
            );

            if (relaunchResult.success) {
              console.log(chalk.green("App re-launched successfully after reconnection.\n"));
              saveState(projectRoot, { lastDeviceId: wifiTarget, lastVariant: variant, lastFlavor: flavor });
              return { exitCode: 0 };
            }
          }

          const apkPath = findBuiltApk(projectRoot, variant, flavor);
          if (!apkPath) {
            console.error(chalk.red("Could not find a built APK to reinstall after reconnecting."));
            return { exitCode: 1 };
          }

          console.log(chalk.yellow("Could not re-launch. Trying re-install...\n"));
          const reinstallResult = await runCommand(
            {
              label: "adb install -r",
              cmd: "adb",
              args: ["-s", wifiTarget, "install", "-r", "-d", apkPath],
              cwd: projectRoot,
            },
            { stdio: "inherit" },
          );

          if (reinstallResult.success) {
            console.log(chalk.green("App re-installed and will launch automatically.\n"));
            saveState(projectRoot, { lastDeviceId: wifiTarget, lastVariant: variant, lastFlavor: flavor });
            return { exitCode: 0 };
          }
        }
      }
    }

    return { exitCode: 1 };
  }

  saveState(projectRoot, {
    lastDeviceId: resolvedTarget,
    lastVariant: variant,
    lastFlavor: flavor,
  });

  console.log(chalk.green("Run complete."));
  return { exitCode: 0 };
}
