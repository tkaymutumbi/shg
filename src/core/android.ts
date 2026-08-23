import { existsSync, mkdirSync, symlinkSync, chmodSync, unlinkSync, copyFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { join } from "node:path";
import { homedir, networkInterfaces } from "node:os";
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
    { label: "adb devices -l", cmd: "adb", args: ["devices", "-l"] },
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

async function waitForConnectedEndpoint(endpoint: string, timeoutMs = 6000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const devices = await listAndroidDevices();
    const port = endpoint.slice(endpoint.lastIndexOf(":"));
    if (devices.some((device) => device.status === "device" && (device.id === endpoint || device.id.endsWith(port)))) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function connectEndpoint(endpoint: string): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await runCommand(
      { label: "adb connect", cmd: "adb", args: ["connect", endpoint] },
      { stdio: "pipe" },
    );
    if (adbConnectSucceeded(result) && await waitForConnectedEndpoint(endpoint)) return true;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return false;
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
    const extractResult = await runCommand(
      { label: "unzip platform-tools", cmd: "powershell", args: ["Expand-Archive", "-Path", zipPath, "-DestinationPath", tmpDir, "-Force"] },
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
  const prefix = deviceId ? ["-s", deviceId] : [];
  const args = [...prefix, "shell", "ip", "-o", "-4", "addr", "show", "scope", "global"];

  const result = await runCommand(
    { label: "adb get device ip", cmd: "adb", args },
    { stdio: "pipe" },
  );

  const directMatch = result.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
  if (!result.success || !directMatch) {
    const ifconfigResult = await runCommand(
      { label: "adb get device ip (fallback)", cmd: "adb", args: [...prefix, "shell", "ifconfig"] },
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
      if (await connectEndpoint(savedEndpoint)) {
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

    if (await connectEndpoint(endpoint)) {
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
    if (await connectEndpoint(endpoint)) {
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
  if (!await connectEndpoint(endpoint)) {
    console.error(chalk.red(`  Failed to connect to ${ip}:5555`));
    return false;
  }

  saveWifiIp(endpoint);
  console.log(chalk.green(`  Connected to ${ip}:5555 over WiFi\n`));
  return true;
}

export function getLanIp(): string {
  const interfaces = networkInterfaces();
  const names = Object.keys(interfaces).sort((a, b) => {
    const score = (name: string) => /^(wl|wifi|en|eth)/i.test(name) ? 0 : /^(docker|veth|br-|vir|tun|tap|tailscale)/i.test(name) ? 2 : 1;
    return score(a) - score(b);
  });
  for (const name of names) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}
