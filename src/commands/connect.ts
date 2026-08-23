import * as p from "@clack/prompts";
import chalk from "chalk";
import {
  checkAdbMdns,
  ensureAdb,
  isWirelessAdbId,
  listAndroidDevices,
  loadWifiIp,
  reconnectSavedWirelessDevice,
  saveWifiIp,
  connectOverWifi,
  isQrPairingAdbVersion,
  parseAdbPlatformToolsVersion,
} from "../core/android.js";
import { runCommand } from "../core/executor.js";
import { emitJson } from "../core/project.js";
import { loadState, saveState } from "../core/state.js";
import { generateAdbQrCredentials, renderAdbQr } from "../core/qr.js";
import { pairWithQr, qrPairingFailureMessage } from "../core/wifi-pairing.js";
import type { CommandContext, CommandResult } from "./types.js";

function rememberDevice(context: CommandContext, endpoint: string): void {
  if (!context.projectRoot) return;
  saveState(context.projectRoot, { ...loadState(context.projectRoot), lastDeviceId: endpoint });
}

function printNetworkDiagnostics(): void {
  console.log(chalk.yellow("  mDNS pairing needs the computer and phone on the same Wi-Fi network."));
  console.log(chalk.dim("  Check VPN isolation, guest-network multicast blocking, and the local firewall."));
  if (process.platform === "win32") {
    console.log(chalk.dim("  Windows: allow adb.exe through Windows Defender Firewall and use a current SDK platform-tools install."));
  }
}

async function runManualFallback(context: CommandContext): Promise<CommandResult> {
  const connected = await connectOverWifi();
  if (!connected) return { exitCode: 1 };

  const devices = await listAndroidDevices();
  const endpoint = devices.find((device) => device.status === "device" && isWirelessAdbId(device.id))?.id
    ?? loadWifiIp();
  if (endpoint) {
    const savedEndpoint = loadWifiIp() ?? endpoint;
    saveWifiIp(savedEndpoint);
    rememberDevice(context, savedEndpoint);
  }

  if (context.json || context.flags.json) {
    emitJson({ success: true, device: endpoint });
  }
  return { exitCode: 0 };
}

export async function runConnect(context: CommandContext): Promise<CommandResult> {
  if (!await ensureAdb()) {
    if (context.json || context.flags.json) emitJson({ success: false, error: "adb is unavailable." });
    return { exitCode: 1 };
  }

  // A saved endpoint is the only persisted wireless credential. QR secrets
  // are deliberately generated after this fast reconnect path succeeds/fails.
  const reconnected = await reconnectSavedWirelessDevice();
  if (reconnected) {
    const endpoint = loadWifiIp() ?? reconnected;
    saveWifiIp(endpoint);
    rememberDevice(context, endpoint);
    if (context.json || context.flags.json) {
      emitJson({ success: true, device: reconnected, endpoint, reused: true });
    } else {
      console.log(chalk.green(`Connected to the previously paired device: ${reconnected}`));
    }
    return { exitCode: 0 };
  }

  // A USB device or an already-authorized ADB transport needs no pairing.
  // Reuse it instead of surprising the user with a new QR prompt.
  const existingDevice = (await listAndroidDevices()).find((device) => device.status === "device");
  if (existingDevice) {
    const endpoint = isWirelessAdbId(existingDevice.id) ? (loadWifiIp() ?? existingDevice.id) : undefined;
    rememberDevice(context, endpoint ?? existingDevice.id);
    if (context.json || context.flags.json) {
      emitJson({ success: true, device: existingDevice.id, endpoint, reused: true, transport: endpoint ? "wifi" : "usb" });
    } else {
      console.log(chalk.green(`Already connected to ${existingDevice.id}${endpoint ? " over Wireless debugging" : " over USB/ADB"}.`));
    }
    return { exitCode: 0 };
  }

  if (context.json || context.flags.json) {
    emitJson({
      success: false,
      error: "QR pairing needs an interactive terminal. Run `shg connect` without --json, then use `shg devices --json` afterward.",
    });
    return { exitCode: 2 };
  }

  const mdns = await checkAdbMdns();
  if (!mdns.available) {
    console.log(chalk.yellow("ADB mDNS discovery is unavailable."));
    if (mdns.message) console.log(chalk.dim(`  ${mdns.message}`));
    printNetworkDiagnostics();

    const shouldFallback = await p.confirm({
      message: "Use the manual IP / pairing-code fallback instead?",
      initialValue: true,
    });
    if (p.isCancel(shouldFallback)) return { exitCode: 130 };
    return shouldFallback ? runManualFallback(context) : { exitCode: 1 };
  }

  const versionResult = await runCommand(
    { label: "adb version", cmd: "adb", args: ["version"], timeout: 10_000 },
    { stdio: "pipe" },
  );
  const versionOutput = `${versionResult.stdout}\n${versionResult.stderr}`;
  const platformToolsVersion = parseAdbPlatformToolsVersion(versionOutput);
  if (platformToolsVersion && !isQrPairingAdbVersion(versionOutput)) {
    console.log(chalk.yellow(`ADB platform-tools ${platformToolsVersion.join(".")} is too old for QR pairing; 30.0.2 or newer is required.`));
    console.log(chalk.dim("  Update SDK Platform-Tools, restart adb, and retry."));
    printNetworkDiagnostics();
    const shouldFallback = await p.confirm({
      message: "Use the manual IP / pairing-code fallback instead?",
      initialValue: true,
    });
    if (p.isCancel(shouldFallback)) return { exitCode: 130 };
    return shouldFallback ? runManualFallback(context) : { exitCode: 1 };
  }

  const credentials = generateAdbQrCredentials();
  let qr: string;
  try {
    qr = await renderAdbQr(credentials.payload);
  } catch (error) {
    console.error(chalk.red(`Could not render the QR code: ${error instanceof Error ? error.message : "unknown error"}`));
    console.log(chalk.yellow("Install the current SHG dependencies and retry, or use the manual pairing-code fallback."));
    return { exitCode: 1 };
  }

  console.log(chalk.cyan("\nPair Android Wireless debugging\n"));
  console.log(chalk.dim("  1. On an Android 11+ phone, open Developer options → Wireless debugging."));
  console.log(chalk.dim("  2. Choose Pair device with QR code."));
  console.log(chalk.dim("  3. Scan this QR code in Android's Wireless debugging screen:\n"));
  console.log(qr);
  console.log(chalk.dim("  Waiting up to 45 seconds for the phone to announce the scanned QR code...\n"));

  const abortController = new AbortController();
  const cancelPairing = () => {
    abortController.abort();
    console.log(chalk.yellow("\n  Pairing cancelled."));
  };
  process.once("SIGINT", cancelPairing);
  let result;
  try {
    result = await pairWithQr(credentials, {
      onStatus: (message) => console.log(chalk.dim(`  ${message}`)),
      signal: abortController.signal,
    });
  } finally {
    process.off("SIGINT", cancelPairing);
  }
  if (!result.success || !result.connectService || !result.deviceId) {
    const message = qrPairingFailureMessage(result.failure ?? "connect-failed");
    console.error(chalk.red(`\n${message}`));
    if (result.failure === "pairing-timeout" || result.failure === "connect-timeout") printNetworkDiagnostics();
    console.log(chalk.yellow("  Fallback: run `shg devices --wifi` and enter the pairing address and six-digit code."));
    return { exitCode: result.failure === "cancelled" ? 130 : 1 };
  }

  // Persist only the post-pairing endpoint. The QR service name and secret
  // are intentionally not written to project or global state.
  saveWifiIp(result.connectService.endpoint);
  rememberDevice(context, result.connectService.endpoint);
  console.log(chalk.green(`\nConnected and paired: ${result.deviceId}`));
  console.log(chalk.dim("  The QR credential was temporary and was not saved."));
  return { exitCode: 0 };
}
