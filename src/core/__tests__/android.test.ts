import { describe, expect, test } from "bun:test";
import { parseAdbDevices } from "../android.js";

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
