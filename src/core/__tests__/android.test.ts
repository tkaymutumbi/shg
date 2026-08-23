import { describe, expect, test } from "bun:test";
import { adbConnectSucceeded, isMatchingAdbEndpoint, normalizeAdbEndpoint, parseAdbDevices, selectConnectedWifiEndpoint } from "../android.js";

describe("parseAdbDevices", () => {
  test("parses device list with model info", () => {
    const output = `List of devices attached
emulator-5554\tdevice\tproduct:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a
0123456789abcdef\tdevice\tmodel:SM_G960F
`;

    const devices = parseAdbDevices(output);
    expect(devices).toHaveLength(2);
    expect(devices[0].id).toBe("emulator-5554");
    expect(devices[0].status).toBe("device");
    expect(devices[0].model).toBe("sdk_gphone64_arm64");
    expect(devices[1].id).toBe("0123456789abcdef");
    expect(devices[1].model).toBe("SM_G960F");
  });

  test("parses device list without model", () => {
    const output = `List of devices attached
emulator-5554\tdevice
`;

    const devices = parseAdbDevices(output);
    expect(devices).toHaveLength(1);
    expect(devices[0].id).toBe("emulator-5554");
    expect(devices[0].model).toBeUndefined();
  });

  test("handles offline devices", () => {
    const output = `List of devices attached
emulator-5554\toffline
`;

    const devices = parseAdbDevices(output);
    expect(devices[0].status).toBe("offline");
  });

  test("empty output", () => {
    expect(parseAdbDevices("")).toEqual([]);
  });

  test("header only", () => {
    expect(parseAdbDevices("List of devices attached\n")).toEqual([]);
  });

  test("unauthorized device", () => {
    const output = `List of devices attached
0123456789abcdef\tunauthorized
`;
    const devices = parseAdbDevices(output);
    expect(devices[0].status).toBe("unauthorized");
  });
});

describe("adbConnectSucceeded", () => {
  test("rejects adb's zero-exit connection failures", () => {
    expect(adbConnectSucceeded({ success: true, stdout: "failed to connect: Connection refused", stderr: "" })).toBe(false);
  });

  test("accepts connected and already-connected responses", () => {
    expect(adbConnectSucceeded({ success: true, stdout: "connected to 192.168.1.2:5555", stderr: "" })).toBe(true);
    expect(adbConnectSucceeded({ success: true, stdout: "already connected to 192.168.1.2:5555", stderr: "" })).toBe(true);
  });
});

describe("normalizeAdbEndpoint", () => {
  test("defaults legacy connections to port 5555", () => {
    expect(normalizeAdbEndpoint("192.168.1.22")).toBe("192.168.1.22:5555");
  });

  test("preserves Android Wireless debugging ports", () => {
    expect(normalizeAdbEndpoint("192.168.1.22:37123")).toBe("192.168.1.22:37123");
  });

  test("rejects invalid endpoints", () => {
    expect(normalizeAdbEndpoint("192.168.1.22:99999")).toBeUndefined();
    expect(normalizeAdbEndpoint("bad host")).toBeUndefined();
  });
});

describe("isMatchingAdbEndpoint", () => {
  test("requires the exact host and port", () => {
    expect(isMatchingAdbEndpoint("192.168.1.22:5555", "192.168.1.22:5555")).toBe(true);
    expect(isMatchingAdbEndpoint("192.168.1.23:5555", "192.168.1.22:5555")).toBe(false);
    expect(isMatchingAdbEndpoint("192.168.1.22:5555", "192.168.1.22:5556")).toBe(false);
  });
});

describe("selectConnectedWifiEndpoint", () => {
  test("prefers the exact IP endpoint when Android also exposes an mDNS alias", () => {
    const devices = parseAdbDevices(`List of devices attached
adb-123._adb-tls-connect._tcp\tdevice\tmodel:Phone
192.168.1.179:44893\tdevice\tmodel:Phone
`);

    expect(selectConnectedWifiEndpoint(devices)).toBe("192.168.1.179:44893");
  });

  test("preserves the requested endpoint during reconnect selection", () => {
    const devices = parseAdbDevices(`List of devices attached
192.168.1.179:44893\tdevice\n192.168.1.180:5555\tdevice\n`);

    expect(selectConnectedWifiEndpoint(devices, "192.168.1.180:5555")).toBe("192.168.1.180:5555");
    expect(selectConnectedWifiEndpoint(devices, "192.168.1.181:5555")).toBe("192.168.1.179:44893");
  });
});
