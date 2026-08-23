import chalk from "chalk";
import { ensureAdb, listAndroidDevices, loadWifiIp, selectReadyAndroidTarget } from "../core/android.js";
import { runCommand } from "../core/executor.js";
import { emitJson } from "../core/project.js";
import { loadState } from "../core/state.js";
import type { CommandContext, CommandResult } from "./types.js";

export function getFilter(tag?: string, level?: string): string {
  if (tag) return `${tag}:${level ?? "D"}`;
  return `Capacitor:${level ?? "D"}`;
}

export async function runLogs(context: CommandContext): Promise<CommandResult> {
  const tag = typeof context.flags.tag === "string" ? context.flags.tag : undefined;
  const level = typeof context.flags.level === "string" ? context.flags.level : undefined;
  const filter = getFilter(tag, level);
  const requestedDevice = typeof context.flags.device === "string" ? context.flags.device : undefined;
  const requiresTarget = Boolean(context.flags.__deviceCommand || requestedDevice);
  let target: string | undefined;

  if (requiresTarget) {
    if (!await ensureAdb()) return { exitCode: 1 };
    const devices = await listAndroidDevices();
    const preferred = requestedDevice
      ?? context.config.defaultDeviceId
      ?? (context.projectRoot ? loadState(context.projectRoot).lastDeviceId : undefined)
      ?? loadWifiIp();
    const savedOnly = !requestedDevice && !context.config.defaultDeviceId
      && !(context.projectRoot ? loadState(context.projectRoot).lastDeviceId : undefined);
    target = (savedOnly && preferred ? selectReadyAndroidTarget(devices, preferred) : undefined)
      ?? selectReadyAndroidTarget(devices, savedOnly ? undefined : preferred);
    if (!target) {
      const available = devices.length > 0 ? devices.map((device) => `${device.id} [${device.status}]`).join(", ") : "none";
      const message = requestedDevice
        ? `ADB target "${requestedDevice}" is not ready. Available: ${available}`
        : `No ready Android device found. Available: ${available}`;
      if (context.json || context.flags.json) emitJson({ success: false, error: message });
      else console.error(chalk.red(message));
      return { exitCode: 1 };
    }
  }

  if (context.json || context.flags.json) {
    emitJson({ filter, tag, level, ...(target ? { device: target } : {}) });
    return { exitCode: 0 };
  }

  console.log(chalk.cyan(`\nTailing logcat with filter: ${filter}${target ? ` on ${target}` : ""}\n`));

  const result = await runCommand(
    {
      label: "adb logcat",
      cmd: "adb",
      args: [...(target ? ["-s", target] : []), "logcat", "-s", filter],
      cwd: context.projectRoot ?? process.cwd(),
      timeout: 0,
    },
    { verbose: context.verbose, stdio: "inherit" },
  );

  return { exitCode: result.success ? 0 : 1 };
}
