import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { requireProjectRoot, hasAndroidPlatform, readWebDir, hasValidAndroidSdk, findAndroidSdkRoot, hasConnectedDevice, getCapacitorDependencyMajorMismatch } from "../core/project.js";
import { ensureAdb, connectOverWifi, getLanIp, listAndroidDevices, reconnectSavedWirelessDevice } from "../core/android.js";
import type { CommandContext, CommandResult } from "./types.js";

const COMMON_DEV_PORTS = [5173, 4173, 5174, 4174, 3000, 8080];

interface DevServerProbe {
  reachable: boolean;
  vite: boolean;
}

async function requestDevServer(host: string, port: number, path = "/"): Promise<Response | undefined> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`http://${host}:${port}${path}`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch {
    return undefined;
  }
}

async function probeDevServer(host: string, port: number): Promise<DevServerProbe> {
  const root = await requestDevServer(host, port);
  if (!root || !root.ok) return { reachable: false, vite: false };

  // A plain HTTP service on the selected port is not enough for live reload.
  // Vite's client endpoint is a stable, cheap way to distinguish it from a
  // stale preview server or an unrelated process.
  const viteClient = await requestDevServer(host, port, "/@vite/client");
  return { reachable: true, vite: Boolean(viteClient?.ok) };
}

export function buildLiveReloadArgs(host: string, port: string, target: string): string[] {
  return [
    "cap", "run", "android", "--live-reload",
    "--host", host,
    "--port", port,
    "--target", target,
  ];
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "0.0.0.0" || host.startsWith("127.") || host === "::1";
}

function validateHost(host: string, wifi: boolean): string | undefined {
  if (!host.trim()) return "Host cannot be empty.";
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(host) || host.includes("/") || /\s/.test(host)) {
    return `Invalid host "${host}". Pass a hostname or LAN IP without http:// or a path.`;
  }
  if (wifi && isLoopbackHost(host) && host !== "0.0.0.0") {
    return `Wi-Fi live reload needs a device-reachable LAN host, not "${host}". Pass --host <LAN-IP>.`;
  }
  return undefined;
}

async function detectDevServerPort(host: string, preferredPort: string, explicitPort: boolean): Promise<string> {
  if (explicitPort) return preferredPort;

  const preferred = Number.parseInt(preferredPort, 10);
  if (Number.isFinite(preferred) && (await probeDevServer(host, preferred)).vite) {
    return preferredPort;
  }

  for (const port of COMMON_DEV_PORTS) {
    if (port === preferred) continue;
    if ((await probeDevServer(host, port)).vite) {
      return String(port);
    }
  }

  return preferredPort;
}

async function waitForDevServer(host: string, port: string, timeoutMs = 20000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if ((await probeDevServer(host, Number.parseInt(port, 10))).vite) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function startDevServer(projectRoot: string, bindHost: string, port: string) {
  return spawn("bun", ["run", "dev", "--", "--host", bindHost, "--port", port, "--strictPort"], {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

function printLiveReloadDiagnostics(host: string, port: string, target: string | undefined, reason: string): void {
  const url = `http://${host}:${port}`;
  console.error(chalk.red(`\nWi-Fi live reload stopped: ${reason}`));
  console.log(chalk.yellow("\nLive-reload preflight details:"));
  console.log(chalk.dim(`  Host: ${host}`));
  console.log(chalk.dim(`  Port: ${port}`));
  console.log(chalk.dim(`  URL:  ${url}`));
  console.log(chalk.dim(`  ADB target: ${target ?? "not selected"}`));
  console.log(chalk.yellow("\nCheck from the laptop:"));
  console.log(chalk.dim(`  curl -v ${url}/`));
  console.log(chalk.dim("  adb devices -l"));
  if (target) console.log(chalk.dim(`  adb -s ${target} get-state`));
  console.log(chalk.yellow("\nIf the app is blank or shows an error:"));
  console.log(chalk.dim("  shg logs --tag Capacitor --level E"));
  console.log(chalk.dim(`  shg screenshot${target ? ` --device ${target}` : ""}`));
  console.log(chalk.dim("  Inspect the printed PNG path with view_image; do not commit the temporary screenshot."));
  console.log(chalk.yellow("\nRepair/check:"));
  console.log(chalk.dim("  bunx cap sync android"));
  console.log(chalk.dim("  shg doctor"));
  console.log(chalk.dim("  For a stable bundled test, run: shg build && shg run"));
}

function checkCapacitorLiveReloadConfig(projectRoot: string, host: string, port: string): string | undefined {
  const configPath = join(projectRoot, "android", "app", "src", "main", "assets", "capacitor.config.json");
  if (!existsSync(configPath)) {
    return `Capacitor Android config is missing at ${configPath}. Run bunx cap sync android.`;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as { appId?: unknown; server?: { url?: unknown } };
    if (typeof config.appId !== "string" || !config.appId) {
      return `Capacitor Android config has no appId at ${configPath}. Run bunx cap sync android.`;
    }
    const expectedUrl = `http://${host}:${port}`;
    if (config.server?.url !== undefined && typeof config.server.url !== "string") {
      return `Capacitor server.url is not a string in ${configPath}. Run bunx cap sync android.`;
    }
    if (typeof config.server?.url === "string" && config.server.url !== expectedUrl) {
      console.log(chalk.yellow(`  Existing Capacitor server.url is ${config.server.url}; live reload will override it with ${expectedUrl}.`));
    }
  } catch {
    return `Capacitor Android config is invalid JSON at ${configPath}. Run bunx cap sync android.`;
  }

  return undefined;
}

export async function runDev(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Dev");
  if (!projectRoot) return { exitCode: 1 };

  const mismatch = getCapacitorDependencyMajorMismatch(projectRoot);
  if (mismatch) {
    console.error(chalk.red("Capacitor package major versions do not match."));
    console.log(chalk.yellow(`  ${Object.entries(mismatch.versions).map(([name, version]) => `${name}=${version}`).join(", ")}`));
    console.log(chalk.dim("  Fix: align Capacitor packages to the same major version, then run `bun install && bunx cap sync android`."));
    return { exitCode: 1 };
  }

  const wifi = Boolean(context.flags.wifi);
  const explicitHost = typeof context.flags.host === "string" ? context.flags.host : undefined;
  let host = explicitHost ?? (wifi ? getLanIp() : "localhost");
  let port = typeof context.flags.port === "string" ? context.flags.port : "5173";
  const explicitPort = typeof context.flags.port === "string";
  const portNumber = Number(port);
  if (!host) {
    printLiveReloadDiagnostics("<unresolved>", port, undefined, "Could not determine a LAN IP. Pass --host <LAN-IP> explicitly.");
    return { exitCode: 2 };
  }
  host = host.trim();
  const initialHostError = validateHost(host, wifi);
  if (initialHostError) {
    if (wifi) printLiveReloadDiagnostics(host, port, undefined, initialHostError);
    else console.error(chalk.red(initialHostError));
    return { exitCode: 2 };
  }
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    console.error(chalk.red(`Invalid port "${port}". Expected an integer between 1 and 65535.`));
    return { exitCode: 2 };
  }
  port = String(portNumber);

  const adbOk = await ensureAdb();
  if (!adbOk) {
    console.log(chalk.dim("  Install platform-tools and ensure `adb` is on PATH."));
    console.log(chalk.dim("  https://developer.android.com/studio/releases/platform-tools"));
    return { exitCode: 1 };
  }

  if (!hasAndroidPlatform(projectRoot)) {
    console.error(chalk.red("Android platform not found."));
    console.log(chalk.yellow("  Run: shg setup --add-android"));
    return { exitCode: 1 };
  }

  const sdkRoot = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  if (!sdkRoot || !hasValidAndroidSdk()) {
    const found = findAndroidSdkRoot();
    if (found) {
      process.env.ANDROID_SDK_ROOT = found;
      process.env.ANDROID_HOME = found;
      console.log(chalk.cyan(`Android SDK detected at: ${found}`));
    } else {
      console.error(chalk.red("No valid Android SDK found."));
      console.log(chalk.yellow("  Install Android Studio, then set ANDROID_SDK_ROOT to your SDK path."));
      return { exitCode: 1 };
    }
  }

  const webDir = readWebDir(projectRoot);
  const webDirPath = join(projectRoot, webDir);
  const indexHtml = join(webDirPath, "index.html");

  if (!existsSync(indexHtml)) {
    if (context.flags["skip-build"]) {
      if (!existsSync(webDirPath)) {
        mkdirSync(webDirPath, { recursive: true });
      }
    } else {
      if (existsSync(webDirPath)) {
        console.log(chalk.yellow(`"${webDir}/index.html" not found. Running build...`));
      } else {
        console.log(chalk.yellow(`Web assets directory "${webDir}" not found. Running build...`));
      }
      const buildResult = await runCommand(
        { label: "bun run build", cmd: "bun", args: ["run", "build"], cwd: projectRoot },
        { verbose: context.verbose, stdio: "inherit" },
      );
      if (!buildResult.success || !existsSync(indexHtml)) {
        console.log(chalk.yellow(`Build did not produce "${webDir}/index.html". Create it or check your build config.`));
        console.log(chalk.dim(`  Expected: ${indexHtml}`));
        return { exitCode: 1 };
      }
    }
  }

  let usingWifi = wifi;
  let wifiTarget: string | undefined;

  if (usingWifi) {
    wifiTarget = await reconnectSavedWirelessDevice() ?? await connectOverWifi();
    if (!wifiTarget) {
      printLiveReloadDiagnostics(host, port, undefined, "Wi-Fi ADB connection was not ready.");
      return { exitCode: 1 };
    }
  }

  if (!usingWifi) {
    const deviceAvailable = await hasConnectedDevice();
    if (!deviceAvailable) {
      console.error(chalk.red("\nNo Android device or emulator detected.\n"));

      const choice = await p.select({
        message: "How would you like to connect?",
        options: [
          { value: "wifi", label: "WiFi", hint: "Connect wirelessly over network" },
          { value: "usb", label: "USB", hint: "Connect via USB cable" },
          { value: "emulator", label: "Emulator", hint: "Start an Android emulator" },
          { value: "cancel", label: "Cancel", hint: "Exit" },
        ],
      });

      if (p.isCancel(choice) || choice === "cancel") {
        console.log(chalk.dim("\n  Run `shg dev --wifi` next time to skip this prompt."));
        return { exitCode: 1 };
      }

      if (choice === "usb") {
        console.log(chalk.yellow("  Connect your device via USB and ensure USB debugging is enabled."));
        console.log(chalk.dim("  Settings → Developer Options → USB Debugging"));
        console.log(chalk.dim("  Run `shg dev` again after connecting.\n"));
        return { exitCode: 1 };
      }

      if (choice === "emulator") {
        console.log(chalk.yellow("  Start an AVD from Android Studio, then run `shg dev` again."));
        console.log(chalk.dim("  Tools → Device Manager → Create Device\n"));
        return { exitCode: 1 };
      }

      if (choice === "wifi") {
        wifiTarget = await connectOverWifi();
        if (!wifiTarget) {
          printLiveReloadDiagnostics(host, port, undefined, "Wi-Fi ADB connection was not ready.");
          return { exitCode: 1 };
        }
        usingWifi = true;
      }

      const recheck = await hasConnectedDevice();
      if (!recheck) {
        console.error(chalk.red("Still no device detected after connection attempt."));
        return { exitCode: 1 };
      }
    }
  }

  if (usingWifi && (!context.flags.host || host === "0.0.0.0")) {
    const detectedLanIp = getLanIp();
    if (!detectedLanIp) {
      printLiveReloadDiagnostics(host, port, wifiTarget, "Could not determine a LAN IP for the live-reload URL. Pass --host <LAN-IP> explicitly.");
      return { exitCode: 2 };
    }
    host = detectedLanIp;
  }

  const hostError = validateHost(host, usingWifi);
  if (hostError) {
    if (usingWifi) printLiveReloadDiagnostics(host, port, wifiTarget, hostError);
    else console.error(chalk.red(hostError));
    return { exitCode: 2 };
  }

  if (usingWifi) {
    const devices = await listAndroidDevices();
    const targetReady = wifiTarget && devices.some((device) => device.id === wifiTarget && device.status === "device");
    if (!targetReady) {
      printLiveReloadDiagnostics(host, port, wifiTarget, "The selected ADB endpoint is no longer ready.");
      return { exitCode: 1 };
    }
  }

  let startedDevServer = false;
  let devServerProcess: ReturnType<typeof startDevServer> | undefined;
  const stopStartedDevServer = () => {
    if (startedDevServer && devServerProcess && !devServerProcess.killed) {
      devServerProcess.kill("SIGTERM");
    }
  };

  const detectedPort = await detectDevServerPort(host, port, explicitPort);
  if (detectedPort !== port) {
    console.log(chalk.yellow(`  Detected running dev server on port ${detectedPort}; using it instead of ${port}.`));
    port = detectedPort;
  }

  const serverProbe = await probeDevServer(host, Number.parseInt(port, 10));
  if (!serverProbe.vite) {
    if (serverProbe.reachable) {
      printLiveReloadDiagnostics(host, port, wifiTarget, `Port ${port} is reachable, but it is not serving Vite at ${host}:${port}.`);
      return { exitCode: 1 };
    }
    const bindHost = usingWifi ? "0.0.0.0" : host;
    console.log(chalk.yellow(`  No dev server detected at http://${host}:${port}. Starting one automatically...`));
    devServerProcess = startDevServer(projectRoot, bindHost, port);
    startedDevServer = true;

    const ready = await waitForDevServer(host, port);
    if (!ready) {
      stopStartedDevServer();
      printLiveReloadDiagnostics(host, port, wifiTarget, `Vite did not become reachable at http://${host}:${port}.`);
      return { exitCode: 1 };
    }
  }

  if (usingWifi) {
    console.log(chalk.cyan(`  Dev server will be accessible at http://${host}:${port} on your device\n`));
  }

  const syncResult = await runCommand(
    { label: "bunx cap sync android", cmd: "bunx", args: ["cap", "sync", "android"], cwd: projectRoot },
    { verbose: context.verbose, stdio: "inherit" },
  );
  if (!syncResult.success) {
    stopStartedDevServer();
    printLiveReloadDiagnostics(host, port, wifiTarget, "Capacitor sync failed before live reload.");
    return { exitCode: 1 };
  }

  const configError = checkCapacitorLiveReloadConfig(projectRoot, host, port);
  if (configError) {
    stopStartedDevServer();
    printLiveReloadDiagnostics(host, port, wifiTarget, configError);
    return { exitCode: 1 };
  }

  console.log(chalk.cyan(`\nStarting optional live reload for ${wifiTarget ?? "the selected Android device"}\n`));

  const cleanup = () => {
    stopStartedDevServer();
  };
  process.once("exit", cleanup);
  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);

  const capArgs = wifiTarget
    ? buildLiveReloadArgs(host, port, wifiTarget)
    : ["cap", "run", "android", "--live-reload", "--host", host, "--port", port];
  const capResult = await runCommand(
    {
      label: "bunx cap run android --live-reload",
      cmd: "bunx",
      args: capArgs,
      cwd: projectRoot,
      timeout: 0,
    },
    { verbose: context.verbose, stdio: "inherit" },
  );

  cleanup();

  if (!capResult.success) {
    printLiveReloadDiagnostics(host, port, wifiTarget, "Capacitor/native-run failed to install or launch the app.");
  }

  return { exitCode: capResult.success ? 0 : 1 };
}
