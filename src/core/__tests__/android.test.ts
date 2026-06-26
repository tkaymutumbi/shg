import { describe, expect, test } from "bun:test";
import { parseAdbDevices, parseAdbMdnsServices } from "../android.js";

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

describe("parseAdbMdnsServices", () => {
  test("parses proto-style adb mdns services output", () => {
    const output = `service {
  service: "_adb-tls-connect._tcp"
  instance: "adb-device-serial"
  ipv4: "10.0.0.42"
  port: 37123
  product_model: "Pixel_7"
}
service {
  service: "_adb-tls-pairing._tcp"
  instance: "adb-qr-test"
  ipv4: "10.0.0.42"
  port: 42851
}
`;

    const services = parseAdbMdnsServices(output);
    expect(services).toHaveLength(2);
    expect(services[0]).toEqual({
      service: "_adb-tls-connect._tcp",
      instance: "adb-device-serial",
      ipv4: "10.0.0.42",
      port: 37123,
      model: "Pixel_7",
    });
    expect(services[1].service).toBe("_adb-tls-pairing._tcp");
    expect(services[1].port).toBe(42851);
  });

  test("parses table-style adb mdns services output", () => {
    const output = `List of discovered mdns services
adb-device-serial._adb-tls-connect._tcp. 10.0.0.42:37123
adb-qr-test._adb-tls-pairing._tcp. 10.0.0.42:42851
`;

    const services = parseAdbMdnsServices(output);
    expect(services).toEqual([
      {
        service: "_adb-tls-connect._tcp",
        instance: "adb-device-serial",
        ipv4: "10.0.0.42",
        port: 37123,
      },
      {
        service: "_adb-tls-pairing._tcp",
        instance: "adb-qr-test",
        ipv4: "10.0.0.42",
        port: 42851,
      },
    ]);
  });
});
