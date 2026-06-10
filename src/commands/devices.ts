import chalk from "chalk";
import { listAndroidDevices } from "../core/android.js";
import { emitJson } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runDevices(context: CommandContext): Promise<CommandResult> {
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
