import chalk from "chalk";
import { runBuild } from "./build.js";
import { launchInstalledApp, getStringFlag } from "./run.js";
import {
  ensureAdb,
  listAndroidDevices,
  reconnectSavedWirelessDevice,
} from "../core/android.js";
import { findBuiltApk } from "../core/apk.js";
import { runCommand } from "../core/executor.js";
import { emitJson, requireProjectRoot } from "../core/project.js";
import { loadState, saveState } from "../core/state.js";
import type { CommandContext, CommandResult } from "./types.js";

export function buildInstallArgs(device: string, apkPath: string): string[] {
  return ["-s", device, "install", "-r", "-d", apkPath];
}

export type InstallFailureKind = "signing" | "downgrade" | "bundle" | "unknown";

export function classifyInstallFailure(output: string): InstallFailureKind {
  if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures? do not match|different signature/i.test(output)) return "signing";
  if (/INSTALL_FAILED_VERSION_DOWNGRADE|version code .* lower|downgrade/i.test(output)) return "downgrade";
  if (/\.aab\b|app bundle|INSTALL_FAILED_INVALID_APK/i.test(output)) return "bundle";
  return "unknown";
}

export function explainInstallFailure(kind: InstallFailureKind): string {
  switch (kind) {
    case "signing":
      return "Android rejected the APK because the installed app was signed with a different key. Uninstall the existing app or use the matching signing configuration before retrying.";
    case "downgrade":
      return "Android rejected the APK because its version code is older than the installed app. Increase the version code or uninstall the installed app; --release must also use the intended signing key.";
    case "bundle":
      return "An Android App Bundle (AAB) cannot be installed with ordinary `adb install`. Build an APK with `shg install --release`, or reserve `shg build --release --aab` for Play Store/bundle distribution.";
    case "unknown":
      return "Android rejected the APK. Check the adb output above and confirm the device is authorized and the APK targets this device.";
  }
}

function outputError(context: CommandContext, error: string, extra: Record<string, unknown> = {}): CommandResult {
  if (context.json || context.flags.json) emitJson({ success: false, error, ...extra });
  else console.error(chalk.red(error));
  return { exitCode: 1 };
}

function resolvedBuildValues(projectRoot: string, context: CommandContext): {
  device?: string;
  variant: string;
  flavor: string;
} {
  const state = loadState(projectRoot);
  const variantFlag = getStringFlag(context.flags, "variant");
  return {
    device: getStringFlag(context.flags, "device") || context.config.defaultDeviceId || state.lastDeviceId,
    variant: variantFlag ?? (context.flags.release ? "release" : state.lastVariant || context.config.defaultVariant || "debug"),
    flavor: getStringFlag(context.flags, "flavor") || state.lastFlavor || context.config.defaultFlavor || "",
  };
}

async function resolveInstallDevice(requested?: string): Promise<string | undefined> {
  let devices = await listAndroidDevices();
  let ready = devices.filter((device) => device.status === "device");

  if (requested) {
    const exact = ready.find((device) => device.id === requested);
    if (exact) return exact.id;
    const reconnected = await reconnectSavedWirelessDevice(requested);
    if (reconnected) return reconnected;
    return undefined;
  }

  if (ready.length === 0) {
    const reconnected = await reconnectSavedWirelessDevice();
    if (reconnected) return reconnected;
    devices = await listAndroidDevices();
    ready = devices.filter((device) => device.status === "device");
  }

  return ready[0]?.id;
}

export async function runInstall(context: CommandContext): Promise<CommandResult> {
  if (context.flags.aab || context.flags.both) {
    return outputError(
      context,
      "`shg install` accepts APKs only. Use `shg build --release --aab` for a Play Store bundle; an AAB is not installable with `adb install`.",
      { artifact: "aab" },
    );
  }

  const projectRoot = requireProjectRoot(context, "Install");
  if (!projectRoot) return { exitCode: 1 };

  const variantFlag = getStringFlag(context.flags, "variant");
  if (context.flags.release && variantFlag && variantFlag !== "release") {
    return outputError(context, 'Conflicting flags: --release cannot be combined with --variant values other than "release".');
  }

  const { device: requestedDevice, variant, flavor } = resolvedBuildValues(projectRoot, context);
  if (!await ensureAdb()) return outputError(context, "adb is unavailable. Install Android platform-tools and retry.");

  if (!context.flags["no-build"]) {
    const buildFlags: Record<string, string | boolean> = {
      ...context.flags,
      variant,
      flavor,
      release: variant === "release",
      __silent: true,
    };
    delete buildFlags.aab;
    delete buildFlags.both;
    const buildResult = await runBuild({ ...context, flags: buildFlags });
    if (buildResult.exitCode !== 0) {
      return outputError(context, `Could not build the ${variant}${flavor ? ` ${flavor}` : ""} APK.`);
    }
  }

  const apkPath = findBuiltApk(projectRoot, variant, flavor);
  if (!apkPath) {
    return outputError(
      context,
      `No installable APK was found for variant "${variant}"${flavor ? ` and flavor "${flavor}"` : ""}. ${context.flags["no-build"] ? "Remove --no-build to build it first." : "Check the Gradle build output."}`,
    );
  }

  const device = await resolveInstallDevice(requestedDevice);
  if (!device) {
    return outputError(
      context,
      "No ready Android device is available. Run `shg connect` for QR wireless pairing, connect USB, or pass --device <id>.",
    );
  }

  const installResult = await runCommand(
    { label: "adb install", cmd: "adb", args: buildInstallArgs(device, apkPath), cwd: projectRoot, timeout: 120_000 },
    { stdio: "pipe" },
  );
  if (!installResult.success) {
    const output = `${installResult.stdout}\n${installResult.stderr}\n${installResult.errorMessage ?? ""}`.trim();
    const kind = classifyInstallFailure(output);
    return outputError(context, `${explainInstallFailure(kind)}${output ? `\n${output}` : ""}`, { device, variant, flavor, apk: apkPath });
  }

  if (!await launchInstalledApp(projectRoot, device)) {
    return outputError(context, "APK installed, but SHG could not resolve and launch the app's launcher activity.", { device, variant, flavor, apk: apkPath });
  }

  saveState(projectRoot, { ...loadState(projectRoot), lastDeviceId: device, lastVariant: variant, lastFlavor: flavor });
  if (context.json || context.flags.json) {
    emitJson({ success: true, device, variant, flavor, artifact: "apk", apk: apkPath });
  } else {
    console.log(chalk.green(`Installed and launched ${variant}${flavor ? ` (${flavor})` : ""} APK on ${device}.`));
    console.log(chalk.dim(`  ${apkPath}`));
  }
  return { exitCode: 0 };
}
