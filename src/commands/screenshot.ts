import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import chalk from "chalk";
import { ensureAdb, listAndroidDevices, loadWifiIp, selectConnectedWifiEndpoint } from "../core/android.js";
import { emitJson } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

const execFileAsync = promisify(execFile);

function getStringFlag(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

export async function runScreenshot(context: CommandContext): Promise<CommandResult> {
  if (!await ensureAdb()) return { exitCode: 1 };

  const devices = (await listAndroidDevices()).filter((device) => device.status === "device");
  const requestedDevice = getStringFlag(context.flags, "device");
  const savedDevice = loadWifiIp();
  const target = requestedDevice
    ?? (savedDevice && devices.some((device) => device.id === savedDevice) ? savedDevice : undefined)
    ?? selectConnectedWifiEndpoint(devices)
    ?? (devices.length === 1 ? devices[0].id : undefined);

  if (!target) {
    const message = devices.length > 0
      ? `Multiple Android devices are ready. Pass --device <exact-id>. Available: ${devices.map((device) => device.id).join(", ")}`
      : "No ready Android device found. Connect one with USB debugging or run `shg devices --wifi`.";
    if (context.json || context.flags.json) emitJson({ success: false, error: message });
    else console.error(chalk.red(message));
    return { exitCode: 1 };
  }

  if (!devices.some((device) => device.id === target)) {
    const message = `ADB target "${target}" is not ready. Run adb devices -l and retry with the exact device ID.`;
    if (context.json || context.flags.json) emitJson({ success: false, error: message });
    else console.error(chalk.red(message));
    return { exitCode: 1 };
  }

  const requestedPath = getStringFlag(context.flags, "output");
  const outputPath = resolve(requestedPath ?? join(tmpdir(), `shg-screen-${Date.now()}.png`));
  mkdirSync(dirname(outputPath), { recursive: true });

  try {
    const result = await execFileAsync("adb", ["-s", target, "exec-out", "screencap", "-p"], {
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024,
    }) as unknown as { stdout: Buffer; stderr: Buffer };
    const screenshot = result.stdout;
    const isPng = screenshot.length >= 8
      && screenshot.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!isPng) {
      throw new Error(result.stderr?.toString("utf8").trim() || "adb returned no PNG screenshot");
    }
    writeFileSync(outputPath, screenshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown adb screenshot failure";
    if (context.json || context.flags.json) emitJson({ success: false, device: target, error: message });
    else {
      console.error(chalk.red(`Screenshot failed for ${target}: ${message}`));
      console.log(chalk.yellow("  Check: adb devices -l"));
      console.log(chalk.yellow("  Logs: shg logs --tag Capacitor --level E"));
    }
    return { exitCode: 1 };
  }

  if (context.json || context.flags.json) {
    emitJson({ success: true, device: target, path: outputPath, temporary: !requestedPath });
  } else {
    console.log(chalk.green(`Screenshot saved: ${outputPath}`));
    console.log(chalk.dim("Inspect it with view_image. Temporary screenshots should not be committed unless explicitly requested."));
  }
  return { exitCode: 0 };
}
