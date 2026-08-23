import * as p from "@clack/prompts";
import chalk from "chalk";
import { runAssets } from "./commands/assets.js";
import { runBuild } from "./commands/build.js";
import { runClean } from "./commands/clean.js";
import { runDeploy } from "./commands/deploy.js";
import { runDev } from "./commands/dev.js";
import { runDevices } from "./commands/devices.js";
import { runLogs } from "./commands/logs.js";
import { runOpen } from "./commands/open.js";
import { runPlugin } from "./commands/plugin.js";
import { runSetup } from "./commands/setup.js";
import { runCreate } from "./commands/create.js";
import { runUpgrade } from "./commands/upgrade.js";
import type { CommandContext } from "./commands/types.js";

export function isCancelled<T>(val: T | symbol): val is symbol {
  if (p.isCancel(val)) {
    p.cancel("Cancelled.");
    return true;
  }
  return false;
}

const CATEGORIES = [
  { value: "dev", label: "Dev Server (Optional Live Reload)", hint: "start Vite + android app" },
  { value: "devices", label: "Connect / List Devices", hint: "USB and WiFi ADB setup" },
  { value: "deploy", label: "Build & Deploy", hint: "smart deploy pipeline" },
  { value: "setup", label: "Capacitor Setup", hint: "install/init/update/add android" },
  { value: "build", label: "Build APK/AAB", hint: "standalone debug or release build" },
  { value: "logs", label: "View Logs", hint: "tail logcat" },
  { value: "plugin", label: "Plugin Manager", hint: "add/list/sync" },
  { value: "create", label: "Create App", hint: "scaffold a new project (React, Vue, Angular, etc.)" },
  { value: "assets", label: "Assets (Icons/Splash)", hint: "generate app assets" },
  { value: "open", label: "Open in Android Studio", hint: "launch Android Studio" },
  { value: "clean", label: "Clean Project", hint: "remove build artifacts" },
  { value: "upgrade", label: "Check Upgrades", hint: "check/update Capacitor" },
];

export async function runInteractive(context: CommandContext): Promise<number> {
  p.intro(chalk.bgCyan(chalk.black(" SHG CLI Interactive ")));

  const category = await p.select({
    message: "What do you want to do?",
    options: CATEGORIES,
  });

  if (isCancelled(category)) return 130;

  if (category === "dev") {
    const connection = await p.select({
      message: "How do you want to run dev?",
      options: [
        { value: "auto", label: "Auto", hint: "Use current defaults and prompt later if needed" },
        { value: "wifi", label: "WiFi", hint: "Optional live reload over LAN" },
        { value: "usb", label: "USB / Emulator", hint: "Use a connected device or running emulator" },
      ],
    });

    if (isCancelled(connection)) return 130;

    const port = await p.text({
      message: "Dev server port:",
      placeholder: "5173",
      initialValue: typeof context.flags.port === "string" ? context.flags.port : "5173",
    });

    if (isCancelled(port)) return 130;

    const flags: Record<string, string | boolean> = { ...context.flags };
    if (connection === "wifi") {
      flags.wifi = true;

      const host = await p.text({
        message: "Host for device access?",
        placeholder: "auto-detect",
        initialValue: typeof context.flags.host === "string" ? context.flags.host : "",
      });

      if (isCancelled(host)) return 130;
      if (host.trim()) flags.host = host.trim();
    }

    if (typeof port === "string" && port.trim()) {
      flags.port = port.trim();
    }

    const result = await runDev({ ...context, flags });
    p.outro(result.exitCode === 0 ? chalk.cyan("SHG done.") : chalk.red("SHG ended with errors."));
    return result.exitCode;
  }

  if (category === "devices") {
    const wifi = await p.confirm({
      message: "Connect or pair a device over WiFi?",
      initialValue: false,
    });
    if (isCancelled(wifi)) return 130;
    const flags: Record<string, string | boolean> = wifi ? { wifi: true } : {};
    const result = await runDevices({ ...context, flags });
    p.outro(result.exitCode === 0 ? chalk.cyan("Device check complete.") : chalk.red("Device connection failed."));
    return result.exitCode;
  }

  if (category === "deploy") {
    const choice = await p.select({
      message: "Pick deploy flow:",
      options: [
        { value: "all", label: "Run ALL (build -> sync -> run)" },
        { value: "build", label: "Build only" },
        { value: "sync", label: "Sync only" },
        { value: "run", label: "Run only" },
      ],
    });

    if (isCancelled(choice)) return 130;

    const flags: Record<string, string | boolean> = { [choice as string]: true };
    const result = await runDeploy({ ...context, flags });
    p.outro(result.exitCode === 0 ? chalk.cyan("SHG done.") : chalk.red("SHG ended with errors."));
    return result.exitCode;
  }

  if (category === "setup") {
    const choice = await p.multiselect({
      message: "Pick setup steps:",
      options: [
        { value: "install", label: "Install Capacitor dependencies" },
        { value: "init", label: "Capacitor init" },
        { value: "update", label: "Capacitor update" },
        { value: "add-android", label: "Add Android platform" },
      ],
      required: false,
    });

    if (isCancelled(choice)) return 130;

    const flags: Record<string, string | boolean> = {};
    for (const item of choice as string[]) {
      flags[item] = true;
    }
    const result = await runSetup({ ...context, flags });
    p.outro(result.exitCode === 0 ? chalk.cyan("SHG done.") : chalk.red("SHG ended with errors."));
    return result.exitCode;
  }

  if (category === "build") {
    const variant = await p.select({
      message: "Pick build variant:",
      options: [
        { value: "debug", label: "Debug" },
        { value: "release", label: "Release" },
      ],
    });

    if (isCancelled(variant)) return 130;

    const flags: Record<string, string | boolean> = variant === "release" ? { release: true } : {};
    const result = await runBuild({ ...context, flags });
    p.outro(result.exitCode === 0 ? chalk.cyan("Build complete.") : chalk.red("Build failed."));
    return result.exitCode;
  }

  if (category === "logs") {
    const tag = await p.text({
      message: "Logcat tag (default: Capacitor):",
      placeholder: "Capacitor",
    });

    if (isCancelled(tag)) return 130;

    const level = await p.select({
      message: "Log level:",
      options: [
        { value: "D", label: "Debug" },
        { value: "I", label: "Info" },
        { value: "W", label: "Warning" },
        { value: "E", label: "Error" },
      ],
    });

    if (isCancelled(level)) return 130;

    const flags: Record<string, string | boolean> = {};
    if (tag && tag !== "Capacitor") flags.tag = tag;
    flags.level = level as string;

    const result = await runLogs({ ...context, flags });
    p.outro(result.exitCode === 0 ? chalk.cyan("Logs done.") : chalk.red("Logs ended with errors."));
    return result.exitCode;
  }

  if (category === "plugin") {
    const action = await p.select({
      message: "Plugin action:",
      options: [
        { value: "list", label: "List installed plugins" },
        { value: "add", label: "Add a plugin" },
        { value: "sync", label: "Sync plugins" },
      ],
    });

    if (isCancelled(action)) return 130;

    let name: string | symbol | undefined;
    if (action === "add") {
      name = await p.text({
        message: "Plugin package name:",
        placeholder: "@capacitor/camera",
      });

      if (isCancelled(name)) return 130;
    }

    const rest: string[] = [action as string];
    if (name && typeof name === "string") rest.push(name);
    const result = await runPlugin(context, rest);
    p.outro(result.exitCode === 0 ? chalk.cyan("Plugin done.") : chalk.red("Plugin ended with errors."));
    return result.exitCode;
  }

  if (category === "assets") {
    const result = await runAssets(context);
    p.outro(result.exitCode === 0 ? chalk.cyan("Assets generated.") : chalk.red("Assets failed."));
    return result.exitCode;
  }

  if (category === "create") {
    const result = await runCreate(context);
    p.outro(result.exitCode === 0 ? chalk.cyan("Project created.") : chalk.red("Create failed."));
    return result.exitCode;
  }

  if (category === "open") {
    const result = await runOpen(context);
    p.outro(result.exitCode === 0 ? chalk.cyan("Project opened.") : chalk.red("Failed to open project."));
    return result.exitCode;
  }

  if (category === "clean") {
    const result = await runClean(context);
    p.outro(result.exitCode === 0 ? chalk.cyan("Project cleaned.") : chalk.red("Clean failed."));
    return result.exitCode;
  }

  if (category === "upgrade") {
    const shouldRun = await p.confirm({
      message: "Run Capacitor upgrade?",
      initialValue: false,
    });

    if (isCancelled(shouldRun)) return 130;

    const flags: Record<string, string | boolean> = {};
    if (shouldRun) flags.run = true;

    const result = await runUpgrade({ ...context, flags });
    p.outro(result.exitCode === 0 ? chalk.cyan("Upgrade done.") : chalk.red("Upgrade failed."));
    return result.exitCode;
  }

  p.cancel("Cancelled.");
  return 130;
}
