import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export interface AdbQrCredentials {
  serviceName: string;
  secret: string;
  payload: string;
}

/** Escape a value according to the Wi-Fi QR format used by Android's camera handler. */
export function escapeWifiQrValue(value: string): string {
  return value.replace(/([\\;,:\"])/g, "\\$1");
}

export function buildAdbQrPayload(serviceName: string, secret: string): string {
  return `WIFI:T:ADB;S:${escapeWifiQrValue(serviceName)};P:${escapeWifiQrValue(secret)};;`;
}

function randomToken(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join("");
}

export function generateStudioServiceName(): string {
  return `studio-${randomToken(10)}`;
}

/**
 * Android documents the QR pairing secret as a short-lived ten-digit secret.
 * It is intentionally returned only to the caller and is never persisted by SHG.
 */
export function generateAdbPairingSecret(): string {
  return Array.from(randomBytes(10), (byte) => String(byte % 10)).join("");
}

export function generateAdbQrCredentials(): AdbQrCredentials {
  const serviceName = generateStudioServiceName();
  const secret = generateAdbPairingSecret();
  return { serviceName, secret, payload: buildAdbQrPayload(serviceName, secret) };
}

export async function renderAdbQr(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: "terminal",
    small: true,
    errorCorrectionLevel: "M",
  });
}

