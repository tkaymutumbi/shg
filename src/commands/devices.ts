import chalk from "chalk";
import { ensureAdb, listAndroidDevices } from "../core/android.js";
import { emitJson } from "../core/project.js";
import { runConnect } from "./connect.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runDevices(context: CommandContext): Promise<CommandResult> {
  if (context.flags.wifi && (context.json || context.flags.json)) {
    emitJson({ success: false, error: "--json and --wifi cannot be combined because WiFi setup may require interactive input." });
    return { exitCode: 2 };
  }
  if (context.flags.wifi) {
    if (!await ensureAdb()) return { exitCode: 1 };
    const connection = await runConnect({ ...context, flags: { ...context.flags, wifi: false } });
    if (connection.exitCode !== 0) return connection;
  }
  const devices = await listAndroidDevices();

  if (context.json || context.flags.json) {
    emitJson({ devices });
    return { exitCode: 0 };
  }

  if (devices.length === 0) {
    console.log(chalk.yellow("No Android devices detected (or adb unavailable)."));
    return { exitCode: 0 };
  }

  console.log(chalk.cyan("\nAndroid devices\n"));
  for (const device of devices) {
    const model = device.model ? ` (${device.model})` : "";
    console.log(`- ${device.id}  [${device.status}]${model}`);
  }
  console.log("");

  return { exitCode: 0 };
}
