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
  const blocks = manifest.match(/<(activity|activity-alias)\b[\s\S]*?<\/\1>/g) ?? [];
  const launcherBlock = blocks.find((block) => (
    /android\.intent\.action\.MAIN/.test(block)
    && /android\.intent\.category\.LAUNCHER/.test(block)
  ));
  const activityName = launcherBlock?.match(/android:name\s*=\s*["']([^"']+)["']/)?.[1];
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

  return matches
    .filter((file) => !/androidtest|unaligned|unsigned/i.test(file))
    .sort((a, b) => a.localeCompare(b))[0];
}

async function launchInstalledApp(projectRoot: string, device: string): Promise<boolean> {
  const appId = readAppId(projectRoot);
  if (!appId) return false;

  let component = readLauncherComponent(projectRoot);
  if (!component) {
    const resolved = await runCommand(
      {
        label: "adb resolve launcher activity",
        cmd: "adb",
        args: ["-s", device, "shell", "cmd", "package", "resolve-activity", "--brief", "-a", "android.intent.action.MAIN", "-c", "android.intent.category.LAUNCHER", appId],
      },
      { stdio: "pipe" },
    );
    component = resolved.stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line.includes("/"));
  }
  if (!component) return false;

  const launched = await runCommand(
    { label: "adb shell am start", cmd: "adb", args: ["-s", device, "shell", "am", "start", "-n", component] },
    { stdio: "pipe" },
  );
  return launched.success;
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
  const quiet = Boolean(context.flags.__silent);
  const log = (...args: unknown[]) => { if (!quiet) console.log(...args); };
  const error = (...args: unknown[]) => { if (!quiet) console.error(...args); };

  let devices = await listAndroidDevices();
  let readyDevices = devices.filter((d) => d.status === "device");
  let resolvedTarget = device;

  const requestedDeviceConnected = resolvedTarget
    ? readyDevices.some((d) => d.id === resolvedTarget)
    : false;

  if (resolvedTarget && !requestedDeviceConnected) {
    if (readyDevices.length === 0) {
      const savedIp = loadWifiIp();
      const shouldReconnect = quiet ? false : await p.confirm({
        message: `Target device "${resolvedTarget}" is not connected${savedIp ? ` (last WiFi: ${savedIp})` : ""}. Try WiFi reconnect?`,
        initialValue: true,
      });

      if (p.isCancel(shouldReconnect)) return { exitCode: 130 };

      if (shouldReconnect) {
        const ok = await connectOverWifi();
        if (ok) {
          devices = await listAndroidDevices();
          readyDevices = devices.filter((d) => d.status === "device");
        }
      }
    }

    if (!readyDevices.some((d) => d.id === resolvedTarget)) {
      error(chalk.red(`Target device "${resolvedTarget}" not found.`));
      log(chalk.dim(`Available: ${formatDeviceList(devices)}`));
      return { exitCode: 1 };
    }
  }

  if (!resolvedTarget && readyDevices.length === 0) {
    const savedIp = loadWifiIp();
    const shouldReconnect = quiet ? false : await p.confirm({
      message: `No ready Android device found${savedIp ? ` (last WiFi: ${savedIp})` : ""}. Try to connect over WiFi?`,
      initialValue: true,
    });

    if (p.isCancel(shouldReconnect)) return { exitCode: 130 };

    if (shouldReconnect) {
      const ok = await connectOverWifi();
      if (ok) {
        devices = await listAndroidDevices();
        readyDevices = devices.filter((d) => d.status === "device");
      }
    }

    if (readyDevices.length === 0) {
      error(chalk.red("No Android device is ready for deployment."));
      if (devices.length > 0) {
        log(chalk.dim(`ADB sees: ${formatDeviceList(devices)}`));
        log(chalk.yellow("Tip: authorize the phone on-device, reconnect USB, or run `adb connect <phone-ip>:5555`."));
      } else {
        log(chalk.yellow("Tip: connect a phone with USB debugging enabled, or use WiFi ADB with `adb connect <phone-ip>:5555`."));
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
        { verbose: context.verbose && !quiet, stdio: quiet ? "pipe" : "inherit" },
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
    { verbose: context.verbose && !quiet, stdio: quiet ? "pipe" : "inherit" },
  );

  if (!result.success) {
    const wifiTarget = resolvedTarget?.includes(":") ? resolvedTarget : undefined;
    if (wifiTarget && !quiet) {
      const deviceCheck = await runCommand(
        { label: "adb devices", cmd: "adb", args: ["devices", "-l"] },
        { stdio: "pipe" },
      );
      const deviceGone = !deviceCheck.stdout.includes(wifiTarget);

      if (deviceGone) {
        log(chalk.yellow("\nWiFi connection dropped during deploy. Reconnecting...\n"));
        const reconnected = await connectOverWifi();
        if (reconnected) {
          log(chalk.dim("App was already installed. Re-launching...\n"));
          if (await launchInstalledApp(projectRoot, wifiTarget)) {
            log(chalk.green("App re-launched successfully after reconnection.\n"));
            saveState(projectRoot, { lastDeviceId: wifiTarget, lastVariant: variant, lastFlavor: flavor });
            return { exitCode: 0 };
          }

          const apkPath = findBuiltApk(projectRoot, variant, flavor);
          if (!apkPath) {
            error(chalk.red("Could not find a matching built APK to reinstall after reconnecting."));
            return { exitCode: 1 };
          }

          log(chalk.yellow("Could not re-launch. Trying re-install...\n"));
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
            if (await launchInstalledApp(projectRoot, wifiTarget)) {
              log(chalk.green("App re-installed and launched successfully.\n"));
              saveState(projectRoot, { lastDeviceId: wifiTarget, lastVariant: variant, lastFlavor: flavor });
              return { exitCode: 0 };
            }
            error(chalk.red("App was re-installed, but its launcher activity could not be started."));
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

  log(chalk.green("Run complete."));
  return { exitCode: 0 };
}
