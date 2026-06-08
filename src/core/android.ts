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

function loadWifiIp(): string | undefined {
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

  if (wirelessDevices.length > 0) {
    console.log(chalk.green(`  Already connected wirelessly: ${wirelessDevices[0].id}`));
    return true;
  }

  if (usbDevices.length === 0) {
    const savedIp = loadWifiIp();

    if (savedIp) {
      console.log(chalk.dim(`  Trying saved device IP: ${savedIp}`));
      const retryResult = await runCommand(
        { label: "adb connect", cmd: "adb", args: ["connect", `${savedIp}:5555`] },
        { stdio: "pipe" },
      );
      if (retryResult.success) {
        console.log(chalk.green(`  Reconnected to ${savedIp}:5555 over WiFi\n`));
        return true;
      }
      console.log(chalk.yellow(`  Could not reconnect to ${savedIp}:5555`));
    }

    const ip = await p.text({
      message: "Enter device IP address (shown in Settings → About phone → Status):",
      placeholder: savedIp ?? "192.168.1.22",
      validate: (val?: string) => (val?.trim() ? undefined : "IP is required"),
    }) as string | symbol;

    if (typeof ip !== "string") {
      console.log(chalk.yellow("  Cancelled."));
      return false;
    }

    const connectResult = await runCommand(
      { label: "adb connect", cmd: "adb", args: ["connect", `${ip.trim()}:5555`] },
      { stdio: "pipe" },
    );

    if (connectResult.success) {
      saveWifiIp(ip.trim());
      console.log(chalk.green(`  Connected to ${ip.trim()}:5555 over WiFi\n`));
      return true;
    }

    console.error(chalk.red("  Connection failed. Make sure:"));  
    console.log(chalk.yellow("  1. Device has Developer Options enabled"));
    console.log(chalk.yellow("  2. USB Debugging is enabled"));
    console.log(chalk.yellow("  3. Device has been authorized (USB connect once if first time)"));
    console.log(chalk.yellow(`  4. Device IP is correct (${ip.trim()})`));
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

  const connectResult = await runCommand(
    { label: "adb connect", cmd: "adb", args: ["connect", `${ip}:5555`] },
    { stdio: "pipe" },
  );

  if (!connectResult.success) {
    console.error(chalk.red(`  Failed to connect to ${ip}:5555`));
    return false;
  }

  saveWifiIp(ip);
  console.log(chalk.green(`  Connected to ${ip}:5555 over WiFi\n`));
  return true;
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
