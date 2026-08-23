import { describe, expect, test } from "bun:test";
import {
  buildAdbQrPayload,
  escapeWifiQrValue,
  generateAdbPairingSecret,
  generateStudioServiceName,
  renderAdbQr,
} from "../qr.js";

describe("Android QR pairing payloads", () => {
  test("escapes Wi-Fi QR delimiters", () => {
    expect(escapeWifiQrValue(String.raw`studio-a;b,c:d"e\\f`)).toBe(String.raw`studio-a\;b\,c\:d\"e\\\\f`);
    expect(buildAdbQrPayload("studio-name", "1234567890")).toBe("WIFI:T:ADB;S:studio-name;P:1234567890;;");
  });

  test("generates Android Studio-compatible credentials", () => {
    const service = generateStudioServiceName();
    const secret = generateAdbPairingSecret();
    expect(service).toMatch(/^studio-[A-Za-z0-9]{10}$/);
    expect(secret).toMatch(/^\d{10}$/);
  });

  test("renders a terminal QR code", async () => {
    const rendered = await renderAdbQr("WIFI:T:ADB;S:studio-test;P:1234567890;;");
    expect(rendered).toContain("\u001b");
    expect(rendered.length).toBeGreaterThan(100);
  });
});
