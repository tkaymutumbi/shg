import { describe, expect, test } from "bun:test";
import {
  adbPairSucceeded,
  findAdbMdnsService,
  isQrPairingAdbVersion,
  parseAdbPlatformToolsVersion,
  parseAdbMdnsServices,
  selectMdnsConnectService,
} from "../android.js";

const SERVICES = `List of discovered mdns services
adb-serial                 _adb._tcp                 192.168.86.38:5555
adb-serial-QXjCrW          _adb-tls-pairing._tcp     192.168.86.38:33861
adb-serial-TnSdi9          _adb-tls-connect._tcp     192.168.86.38:33015
studio-AbCd123456          _adb-tls-pairing._tcp     192.168.86.39:55861
adb-other-TnSdi9           _adb-tls-connect._tcp     192.168.86.40:33015
`;

describe("ADB mDNS parsing", () => {
  test("parses pairing and connect services", () => {
    expect(parseAdbMdnsServices(SERVICES)).toEqual([
      { instanceName: "adb-serial", serviceType: "_adb._tcp", endpoint: "192.168.86.38:5555" },
      { instanceName: "adb-serial-QXjCrW", serviceType: "_adb-tls-pairing._tcp", endpoint: "192.168.86.38:33861" },
      { instanceName: "adb-serial-TnSdi9", serviceType: "_adb-tls-connect._tcp", endpoint: "192.168.86.38:33015" },
      { instanceName: "studio-AbCd123456", serviceType: "_adb-tls-pairing._tcp", endpoint: "192.168.86.39:55861" },
      { instanceName: "adb-other-TnSdi9", serviceType: "_adb-tls-connect._tcp", endpoint: "192.168.86.40:33015" },
    ]);
  });

  test("matches a QR service name exactly", () => {
    const services = parseAdbMdnsServices(SERVICES);
    expect(findAdbMdnsService(services, "_adb-tls-pairing._tcp", "studio-AbCd123456")?.endpoint).toBe("192.168.86.39:55861");
    expect(findAdbMdnsService(services, "_adb-tls-pairing._tcp", "studio-abcd123456")).toBeUndefined();
  });

  test("selects the connect service on the pairing device", () => {
    const services = parseAdbMdnsServices(SERVICES);
    expect(selectMdnsConnectService(services, "192.168.86.39:55861")).toBeUndefined();
    expect(selectMdnsConnectService(services, "192.168.86.38:33861")?.endpoint).toBe("192.168.86.38:33015");
  });
});

describe("ADB QR pairing support", () => {
  test("recognizes current platform-tools and rejects stale versions", () => {
    const current = "Android Debug Bridge version 1.0.41\nVersion 34.0.5-10900879";
    expect(parseAdbPlatformToolsVersion(current)).toEqual([34, 0, 5]);
    expect(isQrPairingAdbVersion(current)).toBe(true);
    expect(isQrPairingAdbVersion("Version 29.0.6")).toBe(false);
  });

  test("distinguishes accepted and rejected pairing responses", () => {
    expect(adbPairSucceeded({ success: true, stdout: "Successfully paired to 192.168.1.25:40000", stderr: "" })).toBe(true);
    expect(adbPairSucceeded({ success: true, stdout: "Failed: incorrect pairing code", stderr: "" })).toBe(false);
  });
});
