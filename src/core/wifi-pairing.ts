import {
  AdbMdnsService,
  connectAdbEndpoint,
  pairAdbEndpoint,
  selectMdnsConnectService,
  waitForAdbMdnsService,
  listAdbMdnsServices,
} from "./android.js";
import type { AdbQrCredentials } from "./qr.js";

export type QrPairingFailure =
  | "pairing-timeout"
  | "pairing-rejected"
  | "connect-timeout"
  | "connect-failed"
  | "cancelled";

export interface QrPairingResult {
  success: boolean;
  pairingService?: AdbMdnsService;
  connectService?: AdbMdnsService;
  deviceId?: string;
  failure?: QrPairingFailure;
}

export interface QrPairingOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  onStatus?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Wait for the phone to advertise the exact QR-requested service, pair with
 * the short-lived QR secret, then connect through the phone's TLS service.
 */
export async function pairWithQr(
  credentials: AdbQrCredentials,
  options: QrPairingOptions = {},
): Promise<QrPairingResult> {
  const timeoutMs = options.timeoutMs ?? 45_000;
  const pollIntervalMs = options.pollIntervalMs ?? 750;
  const status = options.onStatus ?? (() => {});

  if (options.signal?.aborted) return { success: false, failure: "cancelled" };

  status("Waiting for the phone's QR pairing service over mDNS...");
  const pairingService = await waitForAdbMdnsService(
    "_adb-tls-pairing._tcp",
    credentials.serviceName,
    timeoutMs,
    pollIntervalMs,
    options.signal,
  );
  if (!pairingService) {
    return { success: false, failure: options.signal?.aborted ? "cancelled" : "pairing-timeout" };
  }

  status(`Pairing with ${pairingService.endpoint}...`);
  if (!await pairAdbEndpoint(pairingService.endpoint, credentials.secret)) {
    return { success: false, pairingService, failure: "pairing-rejected" };
  }

  status("Waiting for the phone's secure ADB service...");
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (options.signal?.aborted) return { success: false, pairingService, failure: "cancelled" };
    const connectService = selectMdnsConnectService(
      await listAdbMdnsServices(),
      pairingService.endpoint,
    );
    if (connectService) {
      status(`Connecting to ${connectService.endpoint}...`);
      const deviceId = await connectAdbEndpoint(connectService.endpoint);
      if (deviceId) {
        return { success: true, pairingService, connectService, deviceId };
      }
      return { success: false, pairingService, connectService, failure: "connect-failed" };
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return { success: false, pairingService, failure: "connect-timeout" };
}

export function qrPairingFailureMessage(failure: QrPairingFailure): string {
  switch (failure) {
    case "pairing-timeout":
      return "The phone never advertised the QR pairing service. Keep Wireless debugging open, stay on the same Wi-Fi network, and scan the current QR code again.";
    case "pairing-rejected":
      return "Android rejected the QR pairing credential. The QR secret is single-use; run `shg connect` to generate a fresh code.";
    case "connect-timeout":
      return "Pairing succeeded, but the secure ADB service was not discovered. Check mDNS, VPN isolation, guest-network multicast blocking, and the Windows firewall.";
    case "connect-failed":
      return "Pairing succeeded, but adb could not connect to the secure ADB service. Confirm Wireless debugging is still enabled and both devices are on the same network.";
    case "cancelled":
      return "Wireless pairing was cancelled.";
  }
}
