import { describe, expect, test } from "bun:test";
import { generateAdbQrCredentials } from "../qr.js";
import { pairWithQr, qrPairingFailureMessage } from "../wifi-pairing.js";

describe("QR pairing control flow", () => {
  test("honors a cancelled pairing before touching adb", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await pairWithQr(generateAdbQrCredentials(), { signal: controller.signal });
    expect(result).toEqual({ success: false, failure: "cancelled" });
  });

  test("provides actionable timeout and rejection diagnostics", () => {
    expect(qrPairingFailureMessage("pairing-timeout")).toContain("same Wi-Fi");
    expect(qrPairingFailureMessage("pairing-rejected")).toContain("single-use");
    expect(qrPairingFailureMessage("connect-timeout")).toContain("mDNS");
  });
});
