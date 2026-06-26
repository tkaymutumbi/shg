import { existsSync, mkdirSync, symlinkSync, chmodSync, unlinkSync, copyFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { join } from "node:path";
import { homedir, networkInterfaces } from "node:os";
import { runCommand } from "./executor.js";
import { readJsonFile, writeJsonFile } from "./fsjson.js";
import chalk from "chalk";

export interface AndroidDevice {
  id: string;
  status: string;
  model?: string;
}

interface WirelessService {
  service?: string;
  instance?: string;
  ipv4?: string;
  port?: number;
  serial?: string;
  model?: string;
}

const CONNECT_SERVICE_TYPES = new Set(["_adb._tcp", "_adb-tls-connect._tcp"]);
const PAIRING_SERVICE_TYPE = "_adb-tls-pairing._tcp";

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
    { label: "adb devices -l", cmd: "adb", args: ["devices", "-l"] },
    { stdio: "pipe" },
  );

  if (!result.success) return [];
  return parseAdbDevices(result.stdout);
}

export function parseAdbMdnsServices(output: string): WirelessService[] {
  const services: WirelessService[] = [];
  const lines = output.split(/\r?\n/).map((line) => line.trim());
  let current: Partial<WirelessService> | undefined;
  let depth = 0;

  for (const line of lines) {
    const tableService = parseMdnsTableLine(line);
    if (tableService) {
      services.push(tableService);
      continue;
    }

    if (line.endsWith("{")) {
      depth += 1;
      if (line === "service {") {
        current = {};
      }
      continue;
    }

    if (line === "}") {
      if (current && depth >= 1) {
        services.push(current as WirelessService);
        current = undefined;
      }
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (!current) continue;

    const service = line.match(/^service:\s*"([^"]+)"/)?.[1];
    if (service) current.service = service;

    const instance = line.match(/^(?:instance|instance_name|name):\s*"([^"]+)"/)?.[1];
    if (instance) current.instance = instance;

    const ipv4 = line.match(/^ipv4:\s*"([^"]+)"/)?.[1];
    if (ipv4) current.ipv4 = ipv4;

    const serial = line.match(/^serial:\s*"([^"]+)"/)?.[1];
    if (serial) current.serial = serial;

    const model = line.match(/^product_model:\s*"([^"]+)"/)?.[1];
    if (model) current.model = model;

    const port = line.match(/^port:\s*(\d+)/)?.[1];
    if (port) current.port = Number.parseInt(port, 10);
  }

  return services;
}

function parseMdnsTableLine(line: string): WirelessService | undefined {
  const match = line.match(/^(\S+)\s+((?:\d{1,3}\.){3}\d{1,3}):(\d+)\b/);
  if (!match) return undefined;

  const [, instanceAndType, ipv4, port] = match;
  const service = instanceAndType.match(/(_adb(?:-tls-(?:connect|pairing))?\._tcp)\.?$/)?.[1];
  if (!service) return undefined;

  const suffix = `.${service}`;
  const instance = instanceAndType.endsWith(".")
    ? instanceAndType.slice(0, -1).replace(new RegExp(`${escapeRegExp(suffix)}$`), "")
    : instanceAndType.replace(new RegExp(`${escapeRegExp(suffix)}$`), "");

  return {
    service,
    instance,
    ipv4,
    port: Number.parseInt(port, 10),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listWirelessServices(): Promise<WirelessService[]> {
  const result = await runCommand(
    { label: "adb mdns services", cmd: "adb", args: ["mdns", "services"] },
    { stdio: "pipe" },
  );

  if (!result.success) return [];
  return parseAdbMdnsServices(result.stdout);
}

function formatWirelessTarget(service: WirelessService): string | undefined {
  if (!service.ipv4 || !service.port) return undefined;
  return `${service.ipv4}:${service.port}`;
}

async function verifyWirelessDevice(targetId: string): Promise<boolean> {
  const devices = await listAndroidDevices();
  return devices.some((device) => device.id === targetId && device.status === "device");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function findConnectService(services: WirelessService[], preferredIp?: string): WirelessService | undefined {
  const connectServices = services.filter((service) => service.service && CONNECT_SERVICE_TYPES.has(service.service));
  return preferredIp
    ? connectServices.find((service) => service.ipv4 === preferredIp)
    : connectServices[0];
}

function findPairingService(services: WirelessService[], serviceName?: string): WirelessService | undefined {
  const pairingServices = services.filter((service) => service.service === PAIRING_SERVICE_TYPE);
  if (!serviceName) return pairingServices[0];

  return pairingServices.find((service) =>
    service.instance === serviceName || service.serial === serviceName,
  ) ?? (pairingServices.length === 1 ? pairingServices[0] : undefined);
}

async function connectWirelessTarget(targetId: string): Promise<boolean> {
  const connectResult = await runCommand(
    { label: "adb connect", cmd: "adb", args: ["connect", targetId] },
    { stdio: "pipe" },
  );

  if (connectResult.success && await verifyWirelessDevice(targetId)) {
    const [ip] = targetId.split(":");
    if (ip) saveWifiIp(ip);
    console.log(chalk.green(`  Connected to ${targetId} over WiFi\n`));
    return true;
  }

  const detail = connectResult.stderr || connectResult.stdout;
  console.log(chalk.yellow(`  Could not connect to ${targetId}${detail ? `: ${detail.trim()}` : ""}`));
  return false;
}

async function waitForWirelessService(
  serviceName: string,
  timeoutMs: number,
  matcher: (services: WirelessService[]) => WirelessService | undefined,
): Promise<WirelessService | undefined> {
  const startedAt = Date.now();
  const s = p.spinner();
  s.start(serviceName);

  while (Date.now() - startedAt < timeoutMs) {
    const service = matcher(await listWirelessServices());
    if (service) {
      s.stop(`${serviceName}: found ${formatWirelessTarget(service) ?? service.instance ?? "service"}`);
      return service;
    }
    await sleep(1500);
  }

  s.stop(`${serviceName}: not found`);
  return undefined;
}

async function connectAfterPairing(preferredIp?: string): Promise<boolean> {
  const connectService = await waitForWirelessService(
    "Waiting for wireless connect service",
    30000,
    (services) => findConnectService(services, preferredIp),
  );
  const targetId = connectService ? formatWirelessTarget(connectService) : undefined;

  if (targetId) return connectWirelessTarget(targetId);

  if (preferredIp) {
    console.log(chalk.yellow(`  Pairing succeeded, but no connect port was discovered for ${preferredIp}.`));
    console.log(chalk.dim("  Open Developer options -> Wireless debugging, then try SHG again while that screen is open."));
  }

  return false;
}

async function pairWirelessTarget(pairingTarget: string, pairingCode: string): Promise<boolean> {
  const pairResult = await runCommand(
    { label: "adb pair", cmd: "adb", args: ["pair", pairingTarget, pairingCode] },
    { stdio: "pipe" },
  );

  const detail = pairResult.stderr || pairResult.stdout;
  if (!pairResult.success) {
    console.error(chalk.red(`  Pairing failed${detail ? `: ${detail.trim()}` : ""}`));
    return false;
  }

  if (detail.trim()) console.log(chalk.dim(`  ${detail.trim()}`));
  const [ip] = pairingTarget.split(":");
  return connectAfterPairing(ip);
}

async function pairWithCode(discoveredServices: WirelessService[]): Promise<boolean> {
  const pairingServices = discoveredServices.filter((service) => service.service === PAIRING_SERVICE_TYPE);
  const pairingTargetFromService = pairingServices.length === 1 ? formatWirelessTarget(pairingServices[0]) : undefined;

  console.log(chalk.cyan("\nUse the phone's pairing-code screen:"));
  console.log(chalk.dim("  Developer options -> Wireless debugging -> Pair device with pairing code"));

  const address = await p.text({
    message: "Enter pairing IP:port shown on the phone:",
    placeholder: pairingTargetFromService ?? "192.0.2.10:37123",
    initialValue: pairingTargetFromService,
    validate: (val?: string) => (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(val?.trim() ?? "") ? undefined : "Use IP:port, for example 192.0.2.10:37123"),
  }) as string | symbol;

  if (typeof address !== "string") {
    console.log(chalk.yellow("  Cancelled."));
    return false;
  }

  const code = await p.text({
    message: "Enter pairing code:",
    validate: (val?: string) => (val?.trim() ? undefined : "Pairing code is required"),
  }) as string | symbol;

  if (typeof code !== "string") {
    console.log(chalk.yellow("  Cancelled."));
    return false;
  }

  return pairWirelessTarget(address.trim(), code.trim());
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

export async function ensureAdb(): Promise<boolean> {
  const check = await runCommand(
    { label: "adb version", cmd: "adb", args: ["version"] },
    { stdio: "pipe" },
  );

  if (check.success) return true;

  console.log(chalk.yellow("\nadb not found on PATH."));

  const shgBin = getShgBinDir();
  const adbPath = join(shgBin, "adb");

  if (existsSync(adbPath)) {
    const binDir = join(homedir(), ".bun", "bin");
    if (existsSync(binDir)) {
      try {
        const linkPath = join(binDir, "adb");
        if (existsSync(linkPath)) unlinkSync(linkPath);
        symlinkSync(adbPath, linkPath);
        console.log(chalk.green("  adb linked from ~/.shg/bin to ~/.bun/bin"));
        return true;
      } catch {}
    }
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
    await runCommand(
      { label: "unzip platform-tools", cmd: "powershell", args: ["Expand-Archive", "-Path", zipPath, "-DestinationPath", tmpDir, "-Force"] },
      { stdio: "pipe" },
    );
  } else {
    await runCommand(
      { label: "unzip platform-tools", cmd: "unzip", args: ["-o", zipPath, "-d", tmpDir] },
      { stdio: "pipe" },
    );
  }

  mkdirSync(shgBin, { recursive: true });

  const binaries = ["adb", "fastboot"];
  for (const bin of binaries) {
    const ext = process.platform === "win32" ? ".exe" : "";
    const src = join(extractDir, bin + ext);
    const dest = join(shgBin, bin + ext);
    try {
      copyFileSync(src, dest);
      chmodSync(dest, 0o755);

      const bunBin = join(homedir(), ".bun", "bin");
      if (existsSync(bunBin)) {
        const linkPath = join(bunBin, bin);
        if (existsSync(linkPath)) unlinkSync(linkPath);
        symlinkSync(dest, linkPath);
      }
    } catch {}
  }

  const verCheck = await runCommand(
    { label: "adb version", cmd: "adb", args: ["version"] },
    { stdio: "pipe" },
  );

  if (verCheck.success) {
    s.stop("adb installed successfully.");
    return true;
  }

  if (existsSync(adbPath)) {
    console.log(chalk.yellow("  adb installed to ~/.shg/bin. Add it to PATH or restart your terminal."));
    s.stop("adb installed (may need PATH update).");
    return true;
  }

  s.stop("Installation incomplete.");
  console.log(chalk.red("  Could not complete installation. Install platform-tools manually."));
  return false;
}

export async function getDeviceIp(deviceId?: string): Promise<string | undefined> {
  const id = deviceId ?? "-s";
  const args = deviceId ? ["-s", deviceId, "shell", "ip", "addr", "show", "wlan0"] : ["shell", "ip", "addr", "show", "wlan0"];

  const result = await runCommand(
    { label: "adb get device ip", cmd: "adb", args },
    { stdio: "pipe" },
  );

  if (!result.success) {
    const ifconfigResult = await runCommand(
      { label: "adb get device ip (fallback)", cmd: "adb", args: deviceId ? ["-s", deviceId, "shell", "ifconfig", "wlan0"] : ["shell", "ifconfig", "wlan0"] },
      { stdio: "pipe" },
    );
    if (!ifconfigResult.success) return undefined;

    const ipMatch = ifconfigResult.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    return ipMatch?.[1] ?? undefined;
  }

  const ipMatch = result.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
  return ipMatch?.[1] ?? undefined;
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

export async function connectOverWifi(): Promise<boolean> {
  console.log(chalk.cyan("\nSetting up WiFi debugging...\n"));

  const devices = await listAndroidDevices();
  const usbDevices = devices.filter((d) => d.status === "device");
  const wirelessDevices = devices.filter((d) => d.id.includes(":"));
  const discoveredServices = await listWirelessServices();

  if (wirelessDevices.length > 0) {
    console.log(chalk.green(`  Already connected wirelessly: ${wirelessDevices[0].id}`));
    return true;
  }

  const connectService = findConnectService(discoveredServices);
  const targetFromService = connectService ? formatWirelessTarget(connectService) : undefined;

  if (usbDevices.length === 0) {
    const savedIp = loadWifiIp();

    if (targetFromService) {
      console.log(chalk.dim(`  Auto-detected WiFi target: ${targetFromService}`));
      if (await connectWirelessTarget(targetFromService)) return true;
    }

    const reconnectChoice = await p.select({
      message: "Wireless ADB is not connected. What do you want to do?",
      options: [
        { value: "code", label: "Pair with pairing code", hint: "Use the IP:port and code shown by Android" },
        ...(targetFromService ? [{ value: "detected", label: "Use detected connect port", hint: targetFromService }] : []),
        ...(savedIp ? [{ value: "legacy", label: "Try saved legacy port", hint: `${savedIp}:5555` }] : []),
        { value: "manual", label: "Enter connect IP:port", hint: "Use the connect address from Wireless debugging" },
        { value: "cancel", label: "Cancel", hint: "Exit without connecting" },
      ],
    }) as string | symbol;

    if (typeof reconnectChoice !== "string" || reconnectChoice === "cancel") {
      console.log(chalk.yellow("  Cancelled."));
      return false;
    }

    if (reconnectChoice === "code") {
      return pairWithCode(discoveredServices);
    }

    if (reconnectChoice === "detected" && targetFromService) {
      return connectWirelessTarget(targetFromService);
    }

    if (reconnectChoice === "legacy" && savedIp) {
      return connectWirelessTarget(`${savedIp}:5555`);
    }

    if (reconnectChoice === "manual") {
      const target = await p.text({
        message: "Enter connect IP:port shown in Wireless debugging:",
        placeholder: savedIp ? `${savedIp}:37123` : "192.0.2.10:37123",
        validate: (val?: string) => (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(val?.trim() ?? "") ? undefined : "Use IP:port, for example 192.0.2.10:37123"),
      }) as string | symbol;

      if (typeof target !== "string") {
        console.log(chalk.yellow("  Cancelled."));
        return false;
      }

      return connectWirelessTarget(target.trim());
    }

    console.error(chalk.red("  Connection failed. Make sure:"));
    console.log(chalk.yellow("  1. Device has Developer Options enabled"));
    console.log(chalk.yellow("  2. Wireless debugging is enabled and its screen is open"));
    console.log(chalk.yellow("  3. Phone and computer are on the same WiFi"));
    console.log(chalk.yellow("  4. Use pairing code again after the phone restarts"));
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

  const serviceTarget = findConnectService(discoveredServices, ip);
  const targetId = serviceTarget ? formatWirelessTarget(serviceTarget) ?? `${ip}:5555` : `${ip}:5555`;
  return connectWirelessTarget(targetId);
}

export function getLanIp(): string {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}
