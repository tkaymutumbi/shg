import { existsSync, mkdirSync, symlinkSync, chmodSync, unlinkSync, copyFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { delimiter, join } from "node:path";
import { homedir, networkInterfaces } from "node:os";
import { execaSync } from "execa";
import { runCommand } from "./executor.js";
import { readJsonFile, writeJsonFile } from "./fsjson.js";
import chalk from "chalk";
import type { ExecResult } from "./executor.js";

export interface AndroidDevice {
  id: string;
  status: string;
  model?: string;
}

export function parseAdbDevices(output: string): AndroidDevice[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices attached"))
    .map((line) => {
      const [id, status, ...rest] = line.split(/\s+/);
      const modelToken = rest.find((token) => token.startsWith("model:"));
      return {
        id,
        status: status ?? "unknown",
        model: modelToken ? modelToken.replace("model:", "") : undefined,
      };
    })
    .filter((device) => Boolean(device.id));
}

export async function listAndroidDevices(): Promise<AndroidDevice[]> {
  const result = await runCommand(
    { label: "adb devices -l", cmd: "adb", args: ["devices", "-l"], timeout: 10_000 },
    { stdio: "pipe" },
  );

  if (!result.success) return [];
  return parseAdbDevices(result.stdout);
}

function getPlatformToolsUrl(): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "linux") {
    return "https://dl.google.com/android/repository/platform-tools-latest-linux.zip";
  }
  if (platform === "darwin") {
    return arch === "arm64"
      ? "https://dl.google.com/android/repository/platform-tools-latest-darwin-arm64.zip"
      : "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip";
  }
  return "https://dl.google.com/android/repository/platform-tools-latest-windows.zip";
}

function getShgBinDir(): string {
  return join(homedir(), ".shg", "bin");
}

function addToCurrentPath(directory: string): void {
  const currentPath = process.env.PATH ?? "";
  const entries = currentPath.split(delimiter).filter(Boolean);
  const comparable = process.platform === "win32"
    ? directory.toLowerCase()
    : directory;
  const alreadyPresent = entries.some((entry) => (
    process.platform === "win32" ? entry.toLowerCase() : entry
  ) === comparable);

  if (!alreadyPresent) {
    process.env.PATH = [directory, ...entries].join(delimiter);
  }
}

function exposeBundledBinary(binary: string, sourcePath: string): void {
  const bunBin = join(homedir(), ".bun", "bin");
  if (!existsSync(bunBin)) return;

  const extension = process.platform === "win32" ? ".exe" : "";
  const targetPath = join(bunBin, binary + extension);
  if (existsSync(targetPath)) return;

  try {
    symlinkSync(sourcePath, targetPath);
  } catch {
    // Windows may reject symlink creation without Developer Mode or elevation.
    // A copy still makes the bundled tool available from Bun's normal bin dir.
    try {
      copyFileSync(sourcePath, targetPath);
    } catch {}
  }
}

export function adbConnectSucceeded(result: Pick<ExecResult, "success" | "stdout" | "stderr">): boolean {
  if (!result.success) return false;
  const output = `${result.stdout}\n${result.stderr}`;
  return /(?:already )?connected to\b/i.test(output)
    && !/(?:failed|unable|refused|cannot connect)/i.test(output);
}

export function normalizeAdbEndpoint(value: string, defaultPort = 5555): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return undefined;
  const match = trimmed.match(/^([a-zA-Z0-9.-]+)(?::(\d{1,5}))?$/);
  if (!match) return undefined;
  const port = Number.parseInt(match[2] ?? String(defaultPort), 10);
  if (port < 1 || port > 65535) return undefined;
  return `${match[1]}:${port}`;
}

export function isMatchingAdbEndpoint(deviceId: string, endpoint: string): boolean {
  return deviceId.trim().toLowerCase() === endpoint.trim().toLowerCase();
}

function isWirelessAdbId(deviceId: string): boolean {
  return deviceId.includes(":") || /_adb-tls-(?:connect|pairing)\._tcp$/i.test(deviceId);
}

export function selectConnectedWifiEndpoint(
  devices: AndroidDevice[],
  preferredEndpoint?: string,
): string | undefined {
  const readyWireless = devices.filter((device) => device.status === "device" && isWirelessAdbId(device.id));
  if (readyWireless.length === 0) return undefined;

  if (preferredEndpoint) {
    const preferred = preferredEndpoint.trim().toLowerCase();
    const preferredNormalized = normalizeAdbEndpoint(preferredEndpoint)?.toLowerCase();
    const exact = readyWireless.find((device) => {
      const id = device.id.trim().toLowerCase();
      return id === preferred || (preferredNormalized && normalizeAdbEndpoint(device.id)?.toLowerCase() === preferredNormalized);
    });
    if (exact) return exact.id;
  }

  // Android can expose the same phone twice: once as its exact IP:port and
  // once through an mDNS `_adb-tls-connect._tcp` alias. Prefer the endpoint
  // that can be passed directly to adb/native-run.
  return readyWireless.find((device) => Boolean(normalizeAdbEndpoint(device.id)))?.id ?? readyWireless[0].id;
}

/**
 * Select one ready ADB target for device-level commands.
 *
 * An explicit target always wins. When there is only one ready device it is
 * safe to use it directly; with several devices, prefer an exact wireless
 * endpoint so an mDNS alias cannot make ADB act on an ambiguous duplicate.
 */
export function selectReadyAndroidTarget(
  devices: AndroidDevice[],
  preferredEndpoint?: string,
): string | undefined {
  const ready = devices.filter((device) => device.status === "device");
  if (ready.length === 0) return undefined;

  if (preferredEndpoint) {
    const preferred = preferredEndpoint.trim().toLowerCase();
    const preferredNormalized = normalizeAdbEndpoint(preferredEndpoint)?.toLowerCase();
    const exact = ready.find((device) => {
      const id = device.id.trim().toLowerCase();
      return id === preferred
        || (preferredNormalized && normalizeAdbEndpoint(device.id)?.toLowerCase() === preferredNormalized);
    });
    if (exact) return exact.id;
    return undefined;
  }

  if (ready.length === 1) return ready[0].id;
  return selectConnectedWifiEndpoint(ready);
}

async function waitForConnectedEndpoint(endpoint: string, timeoutMs = 6000): Promise<string | undefined> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const devices = await listAndroidDevices();
    const connected = devices.find((device) => device.status === "device" && isMatchingAdbEndpoint(device.id, endpoint));
    if (connected) return connected.id;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return undefined;
}

async function connectEndpoint(endpoint: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await runCommand(
      { label: "adb connect", cmd: "adb", args: ["connect", endpoint], timeout: 15_000 },
      { stdio: "pipe" },
    );
    if (adbConnectSucceeded(result)) {
      const connectedEndpoint = await waitForConnectedEndpoint(endpoint);
      if (connectedEndpoint) return connectedEndpoint;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return undefined;
}

export async function ensureAdb(): Promise<boolean> {
  const check = await runCommand(
    { label: "adb version", cmd: "adb", args: ["version"] },
    { stdio: "pipe" },
  );

  if (check.success) return true;

  console.log(chalk.yellow("\nadb not found on PATH."));

  const shgBin = getShgBinDir();
  const adbPath = join(shgBin, process.platform === "win32" ? "adb.exe" : "adb");

  if (existsSync(adbPath)) {
    addToCurrentPath(shgBin);
    exposeBundledBinary("adb", adbPath);
    const bundledCheck = await runCommand(
      { label: "bundled adb version", cmd: adbPath, args: ["version"] },
      { stdio: "pipe" },
    );
    if (bundledCheck.success) {
      console.log(chalk.green("  Using the bundled adb from ~/.shg/bin for this run."));
      return true;
    }
    console.log(chalk.red("  The bundled adb could not be started."));
    return false;
  }

  const shouldInstall = await p.confirm({
    message: "Download and install platform-tools (adb, fastboot)?",
    initialValue: true,
  });

  if (typeof shouldInstall !== "boolean" || !shouldInstall) {
    console.log(chalk.dim("  Skipping. Install manually: https://developer.android.com/studio/releases/platform-tools"));
    return false;
  }

  const s = p.spinner();
  s.start("Downloading platform-tools...");

  const url = getPlatformToolsUrl();
  const tmpDir = join(homedir(), ".shg");
  const zipPath = join(tmpDir, "platform-tools.zip");

  mkdirSync(tmpDir, { recursive: true });

  const download = await runCommand(
    { label: "curl platform-tools", cmd: "curl", args: ["-fL", url, "-o", zipPath] },
    { stdio: "pipe" },
  );

  if (!download.success) {
    s.stop("Download failed.");
    console.log(chalk.red("  Could not download platform-tools. Install manually."));
    return false;
  }

  s.message("Extracting platform-tools...");
  const extractDir = join(tmpDir, "platform-tools");

  if (process.platform === "win32") {
    const extractResult = await runCommand(
      { label: "unzip platform-tools", cmd: "powershell.exe", args: ["Expand-Archive", "-Path", zipPath, "-DestinationPath", tmpDir, "-Force"] },
      { stdio: "pipe" },
    );
    if (!extractResult.success) {
      s.stop("Extraction failed.");
      return false;
    }
  } else {
    const extractResult = await runCommand(
      { label: "unzip platform-tools", cmd: "unzip", args: ["-o", zipPath, "-d", tmpDir] },
      { stdio: "pipe" },
    );
    if (!extractResult.success) {
      s.stop("Extraction failed. Ensure `unzip` is installed.");
      return false;
    }
  }

  try { unlinkSync(zipPath); } catch {}

  mkdirSync(shgBin, { recursive: true });

  const binaries = ["adb", "fastboot"];
  for (const bin of binaries) {
    const ext = process.platform === "win32" ? ".exe" : "";
    const src = join(extractDir, bin + ext);
    const dest = join(shgBin, bin + ext);
    try {
      copyFileSync(src, dest);
      if (process.platform !== "win32") chmodSync(dest, 0o755);
      exposeBundledBinary(bin, dest);
    } catch {}
  }

  addToCurrentPath(shgBin);
  const verCheck = await runCommand(
    { label: "adb version", cmd: "adb", args: ["version"] },
    { stdio: "pipe" },
  );

  if (verCheck.success) {
    s.stop("adb installed successfully.");
    return true;
  }

  if (existsSync(adbPath)) {
    const bundledCheck = await runCommand(
      { label: "bundled adb version", cmd: adbPath, args: ["version"] },
      { stdio: "pipe" },
    );
    if (bundledCheck.success) {
      console.log(chalk.yellow("  adb installed to ~/.shg/bin for this run. Add that directory to PATH for future terminals."));
      s.stop("adb installed successfully.");
      return true;
    }
  }

  s.stop("Installation incomplete.");
  console.log(chalk.red("  Could not complete installation. Install platform-tools manually."));
  return false;
}

export async function getDeviceIp(deviceId?: string): Promise<string | undefined> {
  const prefix = deviceId ? ["-s", deviceId] : [];
  const routeResult = await runCommand(
    { label: "adb get device route", cmd: "adb", args: [...prefix, "shell", "ip", "route", "get", "1.1.1.1"], timeout: 10_000 },
    { stdio: "pipe" },
  );
  const routeMatch = routeResult.stdout.match(/\bsrc\s+(\d+\.\d+\.\d+\.\d+)/);
  if (routeResult.success && routeMatch) return routeMatch[1];

  const args = [...prefix, "shell", "ip", "-o", "-4", "addr", "show", "scope", "global"];

  const result = await runCommand(
    { label: "adb get device ip", cmd: "adb", args, timeout: 10_000 },
    { stdio: "pipe" },
  );

  const directMatch = result.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
  if (!result.success || !directMatch) {
    const ifconfigResult = await runCommand(
      { label: "adb get device ip (fallback)", cmd: "adb", args: [...prefix, "shell", "ifconfig"], timeout: 10_000 },
      { stdio: "pipe" },
    );
    if (!ifconfigResult.success) return undefined;

    const ipMatch = ifconfigResult.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    return ipMatch?.[1] ?? undefined;
  }

  return directMatch[1];
}

function getWifiStatePath(): string {
  return join(homedir(), ".shg", "wifi-state.json");
}

export function loadWifiIp(): string | undefined {
  const state = readJsonFile<{ lastIp: string }>(getWifiStatePath());
  return state?.lastIp;
}

function saveWifiIp(ip: string): void {
  writeJsonFile(getWifiStatePath(), { lastIp: ip });
}

export async function connectOverWifi(preferredEndpoint?: string): Promise<string | undefined> {
  console.log(chalk.cyan("\nSetting up WiFi debugging...\n"));

  const devices = await listAndroidDevices();
  const usbDevices = devices.filter((d) => d.status === "device" && !isWirelessAdbId(d.id));
  const savedEndpoint = normalizeAdbEndpoint(loadWifiIp() ?? "");
  const requestedEndpoint = preferredEndpoint?.trim() || savedEndpoint;
  const currentEndpoint = selectConnectedWifiEndpoint(devices, requestedEndpoint);

  if (currentEndpoint && (!requestedEndpoint || isMatchingAdbEndpoint(currentEndpoint, requestedEndpoint))) {
    saveWifiIp(currentEndpoint);
    console.log(chalk.green(`  Already connected wirelessly: ${currentEndpoint}`));
    return currentEndpoint;
  }

  if (preferredEndpoint && requestedEndpoint) {
    console.log(chalk.dim(`  Reconnecting to requested device: ${requestedEndpoint}`));
    const reconnectedEndpoint = await connectEndpoint(requestedEndpoint);
    if (reconnectedEndpoint) {
      saveWifiIp(reconnectedEndpoint);
      console.log(chalk.green(`  Reconnected to ${reconnectedEndpoint} over WiFi\n`));
      return reconnectedEndpoint;
    }
    console.error(chalk.red(`  Could not reconnect to ${requestedEndpoint}.`));
    return undefined;
  }

  if (usbDevices.length === 0) {
    if (savedEndpoint) {
      console.log(chalk.dim(`  Trying saved device: ${savedEndpoint}`));
      const reconnectedEndpoint = await connectEndpoint(savedEndpoint);
      if (reconnectedEndpoint) {
        saveWifiIp(reconnectedEndpoint);
        console.log(chalk.green(`  Reconnected to ${reconnectedEndpoint} over WiFi\n`));
        return reconnectedEndpoint;
      }
      console.log(chalk.yellow(`  Could not reconnect to ${savedEndpoint}`));
    }

    const fallbackEndpoint = selectConnectedWifiEndpoint(devices);
    if (fallbackEndpoint) {
      saveWifiIp(fallbackEndpoint);
      console.log(chalk.green(`  Using existing wireless connection: ${fallbackEndpoint}\n`));
      return fallbackEndpoint;
    }

    if (!savedEndpoint) {
      console.log(chalk.dim("  No saved WiFi device found. Enter your device IP to continue."));
      console.log(chalk.dim("  It will be saved for next time."));
    }

    const ip = await p.text({
      message: "Enter device address (IP or IP:port from Wireless debugging):",
      placeholder: savedEndpoint ?? "192.168.1.22:5555",
      validate: (val?: string) => normalizeAdbEndpoint(val ?? "") ? undefined : "Enter a valid host or host:port",
    }) as string | symbol;

    if (typeof ip !== "string") {
      console.log(chalk.yellow("  Cancelled."));
      return undefined;
    }

    const endpoint = normalizeAdbEndpoint(ip);
    if (!endpoint) return undefined;

    const pairedEndpoint = await connectEndpoint(endpoint);
    if (pairedEndpoint) {
      saveWifiIp(pairedEndpoint);
      console.log(chalk.green(`  Connected to ${pairedEndpoint} over WiFi\n`));
      return pairedEndpoint;
    }

    const shouldPair = await p.confirm({
      message: "Connection failed. Pair with Android Wireless debugging first?",
      initialValue: false,
    });
    if (typeof shouldPair !== "boolean" || !shouldPair) {
      console.error(chalk.red(`  Could not connect to ${endpoint}.`));
      return undefined;
    }

    const pairAddress = await p.text({
      message: "Pairing address shown under 'Pair device with pairing code' (IP:port):",
      placeholder: "192.168.1.22:37123",
      validate: (val?: string) => normalizeAdbEndpoint(val ?? "", 0) ? undefined : "Enter a valid host:port",
    });
    if (typeof pairAddress !== "string") return undefined;
    const pairingEndpoint = normalizeAdbEndpoint(pairAddress, 0);
    if (!pairingEndpoint || !pairAddress.includes(":")) return undefined;

    const pairingCode = await p.text({
      message: "Six-digit pairing code:",
      validate: (val?: string) => /^\d{6}$/.test(val?.trim() ?? "") ? undefined : "Enter the six-digit pairing code",
    });
    if (typeof pairingCode !== "string") return undefined;

    const pairResult = await runCommand(
      { label: "adb pair", cmd: "adb", args: ["pair", pairingEndpoint, pairingCode.trim()] },
      { stdio: "pipe" },
    );
    const pairOutput = `${pairResult.stdout}\n${pairResult.stderr}`;
    if (!pairResult.success || !/successfully paired/i.test(pairOutput)) {
      console.error(chalk.red("  Wireless debugging pairing failed."));
      return undefined;
    }

    console.log(chalk.green("  Device paired. Connecting to the Wireless debugging address..."));
    const connectedEndpoint = await connectEndpoint(endpoint);
    if (connectedEndpoint) {
      saveWifiIp(connectedEndpoint);
      console.log(chalk.green(`  Connected to ${connectedEndpoint} over WiFi\n`));
      return connectedEndpoint;
    }

    console.error(chalk.red("  Connection failed. Make sure:"));  
    console.log(chalk.yellow("  1. Device has Developer Options enabled"));
    console.log(chalk.yellow("  2. USB Debugging is enabled"));
    console.log(chalk.yellow("  3. Device has been authorized (USB connect once if first time)"));
    console.log(chalk.yellow(`  4. Wireless debugging address is correct (${endpoint})`));
    return undefined;
  }

  const deviceId = usbDevices[0].id;
  console.log(chalk.dim(`  Device: ${deviceId}`));

  const ip = await getDeviceIp(deviceId);
  if (!ip) {
    console.error(chalk.red("  Could not determine device IP."));
    console.log(chalk.yellow("  Make sure WiFi is enabled on the device."));
    return undefined;
  }

  console.log(chalk.dim(`  Device IP: ${ip}`));

  const tcpipResult = await runCommand(
    { label: "adb tcpip 5555", cmd: "adb", args: ["-s", deviceId, "tcpip", "5555"] },
    { stdio: "pipe" },
  );

  if (!tcpipResult.success) {
    console.error(chalk.red("  Failed to restart adbd in TCP mode."));
    return undefined;
  }

  console.log(chalk.dim("  Restarted adbd in TCP mode on port 5555"));

  const endpoint = `${ip}:5555`;
  const connectedEndpoint = await connectEndpoint(endpoint);
  if (!connectedEndpoint) {
    console.error(chalk.red(`  Failed to connect to ${ip}:5555`));
    return undefined;
  }

  saveWifiIp(connectedEndpoint);
  console.log(chalk.green(`  Connected to ${connectedEndpoint} over WiFi\n`));
  return connectedEndpoint;
}

function isUsableLanIp(value: string): boolean {
  return value !== "0.0.0.0" && !value.startsWith("127.");
}

function getDefaultRouteIp(): string | undefined {
  try {
    const result = process.platform === "win32"
      ? execaSync("route", ["print", "-4", "0.0.0.0"], { reject: false })
      : execaSync("ip", ["-4", "route", "get", "1.1.1.1"], { reject: false });
    if (result.exitCode !== 0) return undefined;

    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const match = process.platform === "win32"
      ? output.match(/^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+\S+\s+(\d+\.\d+\.\d+\.\d+)/m)
      : output.match(/\bsrc\s+(\d+\.\d+\.\d+\.\d+)/);
    return match && isUsableLanIp(match[1]) ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

export function getLanIp(): string | undefined {
  const routeIp = getDefaultRouteIp();
  if (routeIp) return routeIp;

  const interfaces = networkInterfaces();
  const names = Object.keys(interfaces).sort((a, b) => {
    const score = (name: string) => /^(wl|wlan|wi[-_ ]?fi|en|eth|ethernet)/i.test(name)
      ? 0
      : /^(docker|veth|vEthernet|br-|vir|tun|tap|tailscale)/i.test(name)
        ? 2
        : 1;
    return score(a) - score(b);
  });
  for (const name of names) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        if (isUsableLanIp(iface.address)) return iface.address;
      }
    }
  }
  return undefined;
}
