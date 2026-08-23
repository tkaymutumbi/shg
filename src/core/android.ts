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

export type AdbMdnsServiceType =
  | "_adb._tcp"
  | "_adb-tls-pairing._tcp"
  | "_adb-tls-connect._tcp";

export interface AdbMdnsService {
  instanceName: string;
  serviceType: AdbMdnsServiceType;
  endpoint: string;
}

export interface AdbMdnsCheck {
  available: boolean;
  output: string;
  message?: string;
}

export function parseAdbPlatformToolsVersion(output: string): [number, number, number] | undefined {
  const match = output.match(/^\s*Version\s+(\d+)\.(\d+)\.(\d+)/im)
    ?? output.match(/platform-tools[^\d]*(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isQrPairingAdbVersion(output: string): boolean {
  const version = parseAdbPlatformToolsVersion(output);
  if (!version) return false;
  const [major, minor, patch] = version;
  return major > 30 || (major === 30 && (minor > 0 || (minor === 0 && patch >= 2)));
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

const MDNS_SERVICE_PATTERN = /^(?:_adb(?:-tls-(?:pairing|connect))?)\._tcp$/i;

export function parseAdbMdnsServices(output: string): AdbMdnsService[] {
  const services: AdbMdnsService[] = [];

  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^(\S+)\s+(_adb(?:-tls-(?:pairing|connect))?\._tcp)\s+(\S+)\s*$/i);
    if (!match || !MDNS_SERVICE_PATTERN.test(match[2])) continue;

    const endpoint = normalizeAdbEndpoint(match[3], 0);
    if (!endpoint) continue;

    services.push({
      instanceName: match[1],
      serviceType: match[2].toLowerCase() as AdbMdnsServiceType,
      endpoint,
    });
  }

  return services;
}

export function findAdbMdnsService(
  services: AdbMdnsService[],
  serviceType: AdbMdnsServiceType,
  instanceName: string,
): AdbMdnsService | undefined {
  return services.find((service) => (
    service.serviceType === serviceType.toLowerCase() && service.instanceName === instanceName
  ));
}

export function selectMdnsConnectService(
  services: AdbMdnsService[],
  pairingEndpoint?: string,
): AdbMdnsService | undefined {
  const connectServices = services.filter((service) => service.serviceType === "_adb-tls-connect._tcp");
  if (connectServices.length === 0) return undefined;

  if (pairingEndpoint) {
    const pairingHost = getEndpointHost(pairingEndpoint);
    const sameHost = connectServices.filter((service) => getEndpointHost(service.endpoint) === pairingHost);
    if (sameHost.length === 1) return sameHost[0];
  }

  return connectServices.length === 1 ? connectServices[0] : undefined;
}

export async function listAdbMdnsServices(): Promise<AdbMdnsService[]> {
  const result = await runCommand(
    { label: "adb mdns services", cmd: "adb", args: ["mdns", "services"], timeout: 10_000 },
    { stdio: "pipe" },
  );
  if (!result.success) return [];
  return parseAdbMdnsServices(`${result.stdout}\n${result.stderr}`);
}

export async function checkAdbMdns(): Promise<AdbMdnsCheck> {
  const result = await runCommand(
    { label: "adb mdns check", cmd: "adb", args: ["mdns", "check"], timeout: 10_000 },
    { stdio: "pipe" },
  );
  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (result.success && /mdns/i.test(output)) {
    return { available: true, output };
  }
  return {
    available: false,
    output,
    message: "ADB mDNS discovery is unavailable. Update platform-tools and check that multicast/mDNS is allowed on the current network.",
  };
}

export async function waitForAdbMdnsService(
  serviceType: AdbMdnsServiceType,
  instanceName: string,
  timeoutMs = 45_000,
  pollIntervalMs = 750,
  signal?: AbortSignal,
): Promise<AdbMdnsService | undefined> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) return undefined;
    const service = findAdbMdnsService(await listAdbMdnsServices(), serviceType, instanceName);
    if (service) return service;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return undefined;
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
  const match = trimmed.match(/^(\[[0-9a-f:]+\]|[a-zA-Z0-9.-]+)(?::(\d{1,5}))?$/i);
  if (!match) return undefined;
  const port = Number.parseInt(match[2] ?? String(defaultPort), 10);
  if (port < 1 || port > 65535) return undefined;
  return `${match[1]}:${port}`;
}

function getEndpointHost(endpoint: string): string {
  const value = endpoint.trim().toLowerCase();
  if (value.startsWith("[")) return value.slice(0, value.indexOf("]") + 1);
  const separator = value.lastIndexOf(":");
  return separator === -1 ? value : value.slice(0, separator);
}

export function isMatchingAdbEndpoint(deviceId: string, endpoint: string): boolean {
  return deviceId.trim().toLowerCase() === endpoint.trim().toLowerCase();
}

export function isWirelessAdbId(deviceId: string): boolean {
  return deviceId.includes(":") || /_adb-tls-(?:connect|pairing)\._tcp$/i.test(deviceId);
}

async function waitForConnectedEndpoint(endpoint: string, timeoutMs = 6000): Promise<string | undefined> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const devices = await listAndroidDevices();
    const exact = devices.find((device) => device.status === "device" && isMatchingAdbEndpoint(device.id, endpoint));
    if (exact) return exact.id;

    // Modern adb may expose a resolved mDNS alias instead of the IP:port that
    // was passed to `adb connect`. If exactly one wireless device is ready,
    // it is safe to return that alias; multiple devices remain ambiguous.
    const wireless = devices.filter((device) => device.status === "device" && isWirelessAdbId(device.id));
    if (wireless.length === 1) return wireless[0].id;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return undefined;
}

export async function connectAdbEndpoint(endpoint: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await runCommand(
      { label: "adb connect", cmd: "adb", args: ["connect", endpoint], timeout: 15_000 },
      { stdio: "pipe" },
    );
    if (adbConnectSucceeded(result)) {
      const connected = await waitForConnectedEndpoint(endpoint);
      if (connected) return connected;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return undefined;
}

export function adbPairSucceeded(result: Pick<ExecResult, "success" | "stdout" | "stderr">): boolean {
  const output = `${result.stdout}\n${result.stderr}`;
  return result.success
    && /paired/i.test(output)
    && !/(?:failed|rejected|error|unable)/i.test(output);
}

export async function pairAdbEndpoint(endpoint: string, secret: string): Promise<boolean> {
  const result = await runCommand(
    { label: "adb pair", cmd: "adb", args: ["pair", endpoint, secret], timeout: 20_000 },
    { stdio: "pipe" },
  );
  return adbPairSucceeded(result);
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

export function saveWifiIp(ip: string): void {
  writeJsonFile(getWifiStatePath(), { lastIp: ip });
}

/** Reconnect a remembered wireless device without prompting for a new credential. */
export async function reconnectSavedWirelessDevice(preferredEndpoint?: string): Promise<string | undefined> {
  const devices = await listAndroidDevices();
  const requested = normalizeAdbEndpoint(preferredEndpoint ?? loadWifiIp() ?? "");
  const readyWireless = devices.filter((device) => device.status === "device" && isWirelessAdbId(device.id));

  if (requested) {
    const current = readyWireless.find((device) => isMatchingAdbEndpoint(device.id, requested));
    if (current) return current.id;

    const reconnected = await connectAdbEndpoint(requested);
    if (reconnected) {
      saveWifiIp(requested);
      return reconnected;
    }
  } else if (readyWireless.length === 1) {
    const endpoint = normalizeAdbEndpoint(readyWireless[0].id, 0);
    if (endpoint) saveWifiIp(endpoint);
    return readyWireless[0].id;
  }

  const services = (await listAdbMdnsServices()).filter((service) => service.serviceType === "_adb-tls-connect._tcp");
  const candidates = requested
    ? services.filter((service) => getEndpointHost(service.endpoint) === getEndpointHost(requested))
    : services.length === 1 ? services : [];
  if (candidates.length !== 1) return undefined;

  const connected = await connectAdbEndpoint(candidates[0].endpoint);
  if (!connected) return undefined;
  saveWifiIp(candidates[0].endpoint);
  return connected;
}

export async function connectOverWifi(): Promise<boolean> {
  console.log(chalk.cyan("\nSetting up WiFi debugging...\n"));

  const devices = await listAndroidDevices();
  const usbDevices = devices.filter((d) => d.status === "device" && !d.id.includes(":"));
  const wirelessDevices = devices.filter((d) => d.status === "device" && d.id.includes(":"));

  if (wirelessDevices.length > 0) {
    console.log(chalk.green(`  Already connected wirelessly: ${wirelessDevices[0].id}`));
    return true;
  }

  if (usbDevices.length === 0) {
    const savedIp = loadWifiIp();
    const savedEndpoint = savedIp ? normalizeAdbEndpoint(savedIp) : undefined;

    if (savedEndpoint) {
      console.log(chalk.dim(`  Trying saved device: ${savedEndpoint}`));
      if (await connectAdbEndpoint(savedEndpoint)) {
        console.log(chalk.green(`  Reconnected to ${savedEndpoint} over WiFi\n`));
        return true;
      }
      console.log(chalk.yellow(`  Could not reconnect to ${savedEndpoint}`));
    }

    if (!savedIp) {
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
      return false;
    }

    const endpoint = normalizeAdbEndpoint(ip);
    if (!endpoint) return false;

    if (await connectAdbEndpoint(endpoint)) {
      saveWifiIp(endpoint);
      console.log(chalk.green(`  Connected to ${endpoint} over WiFi\n`));
      return true;
    }

    const shouldPair = await p.confirm({
      message: "Connection failed. Pair with Android Wireless debugging first?",
      initialValue: false,
    });
    if (typeof shouldPair !== "boolean" || !shouldPair) {
      console.error(chalk.red(`  Could not connect to ${endpoint}.`));
      return false;
    }

    const pairAddress = await p.text({
      message: "Pairing address shown under 'Pair device with pairing code' (IP:port):",
      placeholder: "192.168.1.22:37123",
      validate: (val?: string) => normalizeAdbEndpoint(val ?? "", 0) ? undefined : "Enter a valid host:port",
    });
    if (typeof pairAddress !== "string") return false;
    const pairingEndpoint = normalizeAdbEndpoint(pairAddress, 0);
    if (!pairingEndpoint || !pairAddress.includes(":")) return false;

    const pairingCode = await p.text({
      message: "Six-digit pairing code:",
      validate: (val?: string) => /^\d{6}$/.test(val?.trim() ?? "") ? undefined : "Enter the six-digit pairing code",
    });
    if (typeof pairingCode !== "string") return false;

    const pairResult = await runCommand(
      { label: "adb pair", cmd: "adb", args: ["pair", pairingEndpoint, pairingCode.trim()] },
      { stdio: "pipe" },
    );
    const pairOutput = `${pairResult.stdout}\n${pairResult.stderr}`;
    if (!pairResult.success || !/successfully paired/i.test(pairOutput)) {
      console.error(chalk.red("  Wireless debugging pairing failed."));
      return false;
    }

    console.log(chalk.green("  Device paired. Connecting to the Wireless debugging address..."));
    if (await connectAdbEndpoint(endpoint)) {
      saveWifiIp(endpoint);
      console.log(chalk.green(`  Connected to ${endpoint} over WiFi\n`));
      return true;
    }

    console.error(chalk.red("  Connection failed. Make sure:"));  
    console.log(chalk.yellow("  1. Device has Developer Options enabled"));
    console.log(chalk.yellow("  2. USB Debugging is enabled"));
    console.log(chalk.yellow("  3. Device has been authorized (USB connect once if first time)"));
    console.log(chalk.yellow(`  4. Wireless debugging address is correct (${endpoint})`));
    return false;
  }

  const deviceId = usbDevices[0].id;
  console.log(chalk.dim(`  Device: ${deviceId}`));

  const ip = await getDeviceIp(deviceId);
  if (!ip) {
    console.error(chalk.red("  Could not determine device IP."));
    console.log(chalk.yellow("  Make sure WiFi is enabled on the device."));
    return false;
  }

  console.log(chalk.dim(`  Device IP: ${ip}`));

  const tcpipResult = await runCommand(
    { label: "adb tcpip 5555", cmd: "adb", args: ["-s", deviceId, "tcpip", "5555"] },
    { stdio: "pipe" },
  );

  if (!tcpipResult.success) {
    console.error(chalk.red("  Failed to restart adbd in TCP mode."));
    return false;
  }

  console.log(chalk.dim("  Restarted adbd in TCP mode on port 5555"));

  const endpoint = `${ip}:5555`;
  if (!await connectAdbEndpoint(endpoint)) {
    console.error(chalk.red(`  Failed to connect to ${ip}:5555`));
    return false;
  }

  saveWifiIp(endpoint);
  console.log(chalk.green(`  Connected to ${ip}:5555 over WiFi\n`));
  return true;
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
