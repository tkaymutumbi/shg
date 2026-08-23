import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import chalk from "chalk";
import {
  ensureAdb,
  isMatchingAdbEndpoint,
  listAndroidDevices,
  loadWifiIp,
  normalizeAdbEndpoint,
  selectReadyAndroidTarget,
} from "../core/android.js";
import { runCommand, type ExecResult } from "../core/executor.js";
import { emitJson, readAppId } from "../core/project.js";
import { loadState } from "../core/state.js";
import type { CommandContext, CommandResult } from "./types.js";
import { runLogs } from "./logs.js";
import { runScreenshot } from "./screenshot.js";

function getStringFlag(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function isExactDeviceId(deviceId: string, requested: string): boolean {
  const left = deviceId.trim().toLowerCase();
  const right = requested.trim().toLowerCase();
  const normalizedRight = normalizeAdbEndpoint(requested)?.toLowerCase();
  return left === right
    || Boolean(normalizedRight && normalizeAdbEndpoint(deviceId)?.toLowerCase() === normalizedRight)
    || isMatchingAdbEndpoint(deviceId, requested);
}

function formatDevices(devices: { id: string; status: string; model?: string }[]): string {
  return devices.length > 0
    ? devices.map((device) => `${device.id} (${device.status}${device.model ? `, ${device.model}` : ""})`).join(", ")
    : "none";
}

async function resolveTarget(context: CommandContext): Promise<{ target?: string; devices: Awaited<ReturnType<typeof listAndroidDevices>> }> {
  if (!await ensureAdb()) return { devices: [] };

  const devices = await listAndroidDevices();
  const ready = devices.filter((device) => device.status === "device");
  const explicit = getStringFlag(context.flags, "device")
    ?? context.config.defaultDeviceId
    ?? (context.projectRoot ? loadState(context.projectRoot).lastDeviceId : undefined);

  if (explicit) {
    const exact = ready.find((device) => isExactDeviceId(device.id, explicit));
    if (!exact) {
      console.error(chalk.red(`ADB target "${explicit}" is not ready.`));
      console.log(chalk.yellow(`Available: ${formatDevices(devices)}`));
      console.log(chalk.dim("If the phone is asleep, wake it and confirm Wireless debugging or USB debugging remains connected."));
      return { devices };
    }
    return { target: exact.id, devices };
  }

  const savedWifiTarget = loadWifiIp();
  const target = (savedWifiTarget ? selectReadyAndroidTarget(ready, savedWifiTarget) : undefined)
    ?? selectReadyAndroidTarget(ready);
  if (!target) {
    console.error(chalk.red("No ready Android device found."));
    if (devices.length > 0) console.log(chalk.yellow(`ADB sees: ${formatDevices(devices)}`));
    console.log(chalk.yellow("Connect USB debugging or run `shg devices --wifi`, then retry."));
    console.log(chalk.dim("A sleeping screen is okay when ADB still reports the device as ready; an offline WiFi connection must be reconnected first."));
  }
  return { target, devices };
}

async function adb(context: CommandContext, target: string, args: string[], label: string): Promise<ExecResult> {
  return runCommand(
    { label, cmd: "adb", args: ["-s", target, ...args], cwd: context.projectRoot ?? process.cwd() },
    { verbose: context.verbose, stdio: "pipe" },
  );
}

function reportFailure(context: CommandContext, target: string, label: string, result: ExecResult): CommandResult {
  const detail = result.errorMessage || result.stderr.trim() || result.stdout.trim() || `adb ${label} failed`;
  if (context.json || context.flags.json) {
    emitJson({ success: false, device: target, action: label, error: detail });
  } else {
    console.error(chalk.red(`${label} failed for ${target}: ${detail}`));
    console.log(chalk.yellow("Check: adb devices -l"));
    console.log(chalk.yellow("Logs: shg device logs --tag Capacitor --level E"));
  }
  return { exitCode: 1 };
}

function reportSuccess(context: CommandContext, target: string, action: string, extra: Record<string, unknown> = {}): CommandResult {
  if (context.json || context.flags.json) {
    emitJson({ success: true, device: target, action, ...extra });
  } else {
    console.log(chalk.green(`${action} complete on ${target}.`));
  }
  return { exitCode: 0 };
}

function isCoordinate(value: string): boolean {
  return /^\d+$/.test(value);
}

function encodeInputText(value: string): string {
  // Android's input tool uses %s for spaces. Keep this small and predictable;
  // adb still receives the value as one argv item, so it is not shell-expanded.
  return value.replace(/%/g, "%25").replace(/ /g, "%s");
}

export function normalizeKeyEvent(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) return undefined;
  return trimmed.toUpperCase().startsWith("KEYCODE_")
    ? trimmed.toUpperCase()
    : `KEYCODE_${trimmed.toUpperCase()}`;
}

export function parseDevicePowerState(powerOutput: string, windowOutput = ""): {
  screen: "on" | "off" | "unknown";
  locked: "locked" | "unlocked" | "unknown";
  wakefulness?: string;
} {
  const wakefulness = powerOutput.match(/mWakefulness=(\w+)/i)?.[1];
  const displayState = powerOutput.match(/(?:Display Power|mDisplayPowerState):[^\n]*state=(ON|OFF)/i)?.[1];
  const interactive = powerOutput.match(/mInteractive=(true|false)/i)?.[1];
  const screen = displayState?.toUpperCase() === "ON"
    || interactive?.toLowerCase() === "true"
    || wakefulness?.toLowerCase() === "awake"
    ? "on"
    : displayState?.toUpperCase() === "OFF"
      || interactive?.toLowerCase() === "false"
      || ["asleep", "dozing"].includes(wakefulness?.toLowerCase() ?? "")
      ? "off"
      : "unknown";

  const locked = /(?:mShowingLockscreen|mKeyguardShowing|isStatusBarKeyguard|isKeyguardShowing|mIsShowing|mDreamingLockscreen)=(true|1)/i.test(windowOutput)
    ? "locked"
    : /(?:mShowingLockscreen|mKeyguardShowing|isStatusBarKeyguard|isKeyguardShowing|mIsShowing|mDreamingLockscreen)=(false|0)/i.test(windowOutput)
      ? "unlocked"
      : "unknown";

  return { screen, locked, ...(wakefulness ? { wakefulness } : {}) };
}

async function wakeTarget(context: CommandContext, target: string, quiet = false): Promise<ExecResult> {
  const result = await adb(context, target, ["shell", "input", "keyevent", "KEYCODE_WAKEUP"], "Wake device");
  if (!result.success) return result;

  if (context.flags["keep-awake"] || context.flags["stay-awake"]) {
    const stayOn = await adb(context, target, ["shell", "svc", "power", "stayon", "true"], "Keep device awake");
    if (!stayOn.success) return stayOn;
    if (!quiet && !context.json && !context.flags.json) console.log(chalk.dim("  Keep-awake mode enabled while the device is connected."));
  }
  return result;
}

async function runList(context: CommandContext): Promise<CommandResult> {
  if (!await ensureAdb()) return { exitCode: 1 };
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

async function runStatus(context: CommandContext, target: string): Promise<CommandResult> {
  const [power, window] = await Promise.all([
    adb(context, target, ["shell", "dumpsys", "power"], "Read power state"),
    adb(context, target, ["shell", "dumpsys", "window"], "Read lock state"),
  ]);
  if (!power.success) return reportFailure(context, target, "Read power state", power);
  if (!window.success) return reportFailure(context, target, "Read lock state", window);

  const state = parseDevicePowerState(power.stdout, window.stdout);
  if (context.json || context.flags.json) {
    emitJson({ success: true, device: target, ...state });
  } else {
    console.log(chalk.cyan(`\nDevice: ${target}`));
    console.log(`Screen: ${state.screen}`);
    console.log(`Lock: ${state.locked}`);
    if (state.wakefulness) console.log(`Wakefulness: ${state.wakefulness}`);
    console.log(chalk.dim("Use `shg device wake` before interaction if the screen is off."));
  }
  return { exitCode: 0 };
}

async function runWake(context: CommandContext, target: string): Promise<CommandResult> {
  const result = await wakeTarget(context, target);
  if (!result.success) return reportFailure(context, target, "Wake device", result);
  return reportSuccess(context, target, "Wake device", { keepAwake: Boolean(context.flags["keep-awake"] || context.flags["stay-awake"]) });
}

async function runTap(context: CommandContext, target: string, args: string[]): Promise<CommandResult> {
  if (args.length !== 2 || !args.every(isCoordinate)) {
    console.error(chalk.red("Usage: shg device tap <x> <y>"));
    return { exitCode: 2 };
  }
  if (context.flags.wake) {
    const wake = await wakeTarget(context, target, true);
    if (!wake.success) return reportFailure(context, target, "Wake device", wake);
  }
  const result = await adb(context, target, ["shell", "input", "tap", ...args], "Tap");
  if (!result.success) return reportFailure(context, target, "Tap", result);
  return reportSuccess(context, target, `Tap ${args[0]} ${args[1]}`);
}

async function runSwipe(context: CommandContext, target: string, args: string[]): Promise<CommandResult> {
  if ((args.length !== 4 && args.length !== 5) || !args.slice(0, 4).every(isCoordinate) || (args[4] !== undefined && !isCoordinate(args[4]))) {
    console.error(chalk.red("Usage: shg device swipe <x1> <y1> <x2> <y2> [duration-ms]"));
    return { exitCode: 2 };
  }
  if (context.flags.wake) {
    const wake = await wakeTarget(context, target, true);
    if (!wake.success) return reportFailure(context, target, "Wake device", wake);
  }
  const result = await adb(context, target, ["shell", "input", "swipe", ...args, ...(args.length === 4 ? ["300"] : [])], "Swipe");
  if (!result.success) return reportFailure(context, target, "Swipe", result);
  return reportSuccess(context, target, "Swipe");
}

async function runText(context: CommandContext, target: string, args: string[]): Promise<CommandResult> {
  const value = getStringFlag(context.flags, "text") ?? args.join(" ");
  if (!value) {
    console.error(chalk.red("Usage: shg device text <text>"));
    return { exitCode: 2 };
  }
  if (context.flags.wake) {
    const wake = await wakeTarget(context, target, true);
    if (!wake.success) return reportFailure(context, target, "Wake device", wake);
  }
  const result = await adb(context, target, ["shell", "input", "text", encodeInputText(value)], "Type text");
  if (!result.success) return reportFailure(context, target, "Type text", result);
  return reportSuccess(context, target, "Type text");
}

async function runKey(context: CommandContext, target: string, args: string[]): Promise<CommandResult> {
  const value = getStringFlag(context.flags, "key") ?? args[0];
  const key = value ? normalizeKeyEvent(value) : undefined;
  if (!key || args.length > 1) {
    console.error(chalk.red("Usage: shg device key <keycode|name> (for example: back, enter, home)"));
    return { exitCode: 2 };
  }
  const result = await adb(context, target, ["shell", "input", "keyevent", key], "Key event");
  if (!result.success) return reportFailure(context, target, "Key event", result);
  return reportSuccess(context, target, `Key ${key}`);
}

async function resolveLauncher(context: CommandContext, target: string, packageName: string): Promise<string | undefined> {
  const result = await adb(context, target, [
    "shell", "cmd", "package", "resolve-activity", "--brief",
    "-a", "android.intent.action.MAIN",
    "-c", "android.intent.category.LAUNCHER",
    packageName,
  ], "Resolve launcher activity");
  if (!result.success) return undefined;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line.includes("/") && !line.startsWith("No "));
}

async function runLaunch(context: CommandContext, target: string, args: string[]): Promise<CommandResult> {
  const packageName = getStringFlag(context.flags, "package") ?? args[0] ?? (context.projectRoot ? readAppId(context.projectRoot) : undefined);
  if (!packageName || !/^[A-Za-z][A-Za-z0-9_.]+$/.test(packageName)) {
    console.error(chalk.red("Usage: shg device launch [--package <app-id>]"));
    console.log(chalk.dim("Run it from a Capacitor project or provide --package explicitly."));
    return { exitCode: 2 };
  }
  if (context.flags.wake) {
    const wake = await wakeTarget(context, target, true);
    if (!wake.success) return reportFailure(context, target, "Wake device", wake);
  }
  const component = await resolveLauncher(context, target, packageName);
  if (!component) {
    console.error(chalk.red(`Could not resolve a launcher activity for ${packageName}.`));
    console.log(chalk.yellow("Make sure the app is installed and exposes a launcher activity."));
    return { exitCode: 1 };
  }
  const result = await adb(context, target, ["shell", "am", "start", "-n", component], "Launch app");
  if (!result.success) return reportFailure(context, target, "Launch app", result);
  return reportSuccess(context, target, "Launch app", { package: packageName, component });
}

async function runDumpUi(context: CommandContext, target: string): Promise<CommandResult> {
  const remotePath = "/sdcard/shg-window.xml";
  if (context.flags.wake) {
    const wake = await wakeTarget(context, target, true);
    if (!wake.success) return reportFailure(context, target, "Wake device", wake);
  }
  const dump = await adb(context, target, ["shell", "uiautomator", "dump", remotePath], "Dump UI hierarchy");
  const dumpOutput = `${dump.stdout}\n${dump.stderr}`;
  if (!dump.success || /(?:^|\n)\s*(?:ERROR|Error):|could not get idle state|no node found/i.test(dumpOutput)) {
    const failure = reportFailure(context, target, "Dump UI hierarchy", {
      ...dump,
      success: false,
      stderr: dumpOutput.trim(),
    });
    if (!context.json && !context.flags.json && /idle state|lock|keyguard/i.test(dumpOutput)) {
      console.log(chalk.yellow("  UIAutomator may be blocked by a sleeping or locked screen. Run `shg device wake`, unlock the phone, and retry."));
    }
    return failure;
  }

  const contents = await adb(context, target, ["exec-out", "cat", remotePath], "Read UI hierarchy");
  await adb(context, target, ["shell", "rm", remotePath], "Clean UI hierarchy");
  if (!contents.success || !/<hierarchy(?:\s|>)/i.test(contents.stdout)) {
    const failure = reportFailure(context, target, "Read UI hierarchy", {
      ...contents,
      success: false,
      stderr: contents.stderr.trim() || contents.stdout.trim() || "ADB did not return a UI hierarchy XML document.",
    });
    if (!context.json && !context.flags.json) {
      console.log(chalk.yellow("  The device did not return a UI hierarchy. Unlock the phone if necessary, then retry."));
    }
    return failure;
  }

  const outputPath = getStringFlag(context.flags, "output");
  if (outputPath) {
    const path = resolve(outputPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents.stdout);
    return reportSuccess(context, target, "Dump UI hierarchy", { path });
  }
  if (context.json || context.flags.json) {
    emitJson({ success: true, device: target, action: "Dump UI hierarchy", xml: contents.stdout });
  } else {
    console.log(contents.stdout);
  }
  return { exitCode: 0 };
}

async function runShell(context: CommandContext, target: string, args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    console.error(chalk.red("Usage: shg device shell <adb-shell-command>"));
    return { exitCode: 2 };
  }
  const result = await adb(context, target, ["shell", ...args], "ADB shell");
  if (!result.success) return reportFailure(context, target, "ADB shell", result);
  if (context.json || context.flags.json) {
    emitJson({ success: true, device: target, action: "ADB shell", command: args, stdout: result.stdout, stderr: result.stderr });
  } else if (result.stdout) {
    console.log(result.stdout.trimEnd());
  }
  return { exitCode: 0 };
}

export async function runDevice(context: CommandContext, rest: string[]): Promise<CommandResult> {
  const [subcommand = "status", ...args] = rest;
  const normalized = subcommand.toLowerCase();

  if (["help", "--help"].includes(normalized)) {
    console.log(`Usage: shg device <command> [options]

Commands:
  list                         List ADB devices
  status                       Show screen, lock, and wakefulness state
  wake                         Wake the screen (use --keep-awake to prevent sleep)
  screenshot                   Capture a temporary PNG
  tap <x> <y>                  Tap screen coordinates
  swipe <x1> <y1> <x2> <y2>   Swipe coordinates (optional duration-ms)
  text <text>                  Type text into the focused field
  key <name|code>              Send a key event (back, enter, home, ...)
  launch [--package <id>]      Launch the project app or a package
  logs                         Tail filtered logcat
  dump-ui [--output <path>]    Dump the UIAutomator hierarchy
  shell <command>              Run an ADB shell command

Most commands accept --device <exact-id>. Add --wake to tap, swipe, text, or launch.
`);
    return { exitCode: 0 };
  }

  if (normalized === "list" || normalized === "devices") return runList(context);
  if (normalized === "screenshot" || normalized === "screen") {
    if (context.flags.wake) {
      const resolved = await resolveTarget(context);
      if (!resolved.target) return { exitCode: 1 };
      const wake = await wakeTarget(context, resolved.target, true);
      if (!wake.success) return reportFailure(context, resolved.target, "Wake device", wake);
    }
    return runScreenshot(context);
  }
  if (normalized === "logs" || normalized === "logcat") {
    return runLogs({ ...context, flags: { ...context.flags, __deviceCommand: true } });
  }

  const resolved = await resolveTarget(context);
  if (!resolved.target) return { exitCode: 1 };
  const { target } = resolved;

  switch (normalized) {
    case "status":
      return runStatus(context, target);
    case "wake":
      return runWake(context, target);
    case "tap":
      return runTap(context, target, args);
    case "swipe":
      return runSwipe(context, target, args);
    case "text":
      return runText(context, target, args);
    case "key":
    case "keyevent":
      return runKey(context, target, args);
    case "launch":
      return runLaunch(context, target, args);
    case "dump-ui":
    case "ui-dump":
    case "ui":
      return runDumpUi(context, target);
    case "shell":
      return runShell(context, target, args);
    default:
      console.error(chalk.red(`Unknown device command: ${subcommand}`));
      console.log(chalk.dim("Run `shg device --help` to see available commands."));
      return { exitCode: 2 };
  }
}
