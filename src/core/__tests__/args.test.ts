import { describe, expect, test } from "bun:test";
import { parseArgs } from "../args.js";

describe("parseArgs", () => {
  test("no args", () => {
    const result = parseArgs([]);
    expect(result.command).toBeUndefined();
    expect(result.flags).toEqual({});
    expect(result.rest).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  test("command only", () => {
    const result = parseArgs(["doctor"]);
    expect(result.command).toBe("doctor");
    expect(result.rest).toEqual([]);
  });

  test("recognizes QR connect and APK install options", () => {
    const result = parseArgs(["install", "--release", "--variant", "release", "--flavor", "free", "--device", "phone", "--no-build", "--no-sync"]);
    expect(result.command).toBe("install");
    expect(result.flags.release).toBe(true);
    expect(result.flags.variant).toBe("release");
    expect(result.flags.flavor).toBe("free");
    expect(result.flags.device).toBe("phone");
    expect(result.flags["no-build"]).toBe(true);
    expect(result.flags["no-sync"]).toBe(true);
    expect(parseArgs(["connect"]).errors).toEqual([]);
  });

  test("command with rest args", () => {
    const result = parseArgs(["plugin", "add", "@capacitor/camera"]);
    expect(result.command).toBe("plugin");
    expect(result.rest).toEqual(["add", "@capacitor/camera"]);
  });

  test("screenshot command accepts an output path", () => {
    const result = parseArgs(["screenshot", "--device", "192.168.1.179:44893", "--output", "/tmp/screen.png"]);
    expect(result.command).toBe("screenshot");
    expect(result.flags.device).toBe("192.168.1.179:44893");
    expect(result.flags.output).toBe("/tmp/screen.png");
    expect(result.errors).toEqual([]);
  });

  test("device command preserves its subcommand and action flags", () => {
    const result = parseArgs(["device", "tap", "10", "20", "--device", "emulator-5554", "--wake"]);
    expect(result.command).toBe("device");
    expect(result.rest).toEqual(["tap", "10", "20"]);
    expect(result.flags.device).toBe("emulator-5554");
    expect(result.flags.wake).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("unknown command produces error", () => {
    const result = parseArgs(["foobar"]);
    expect(result.errors).toContain("Unknown command: foobar");
  });

  test("boolean flags", () => {
    const result = parseArgs(["doctor", "--fix", "--verbose"]);
    expect(result.flags.fix).toBe(true);
    expect(result.flags.verbose).toBe(true);
  });

  test("--help and -h", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  test("--version and -v", () => {
    expect(parseArgs(["--version"]).version).toBe(true);
    expect(parseArgs(["-v"]).version).toBe(true);
  });

  test("value flags with next arg", () => {
    const result = parseArgs(["run", "--device", "emulator-5554"]);
    expect(result.flags.device).toBe("emulator-5554");
  });

  test("value flags with inline equals", () => {
    const result = parseArgs(["dev", "--host=0.0.0.0", "--port=5173"]);
    expect(result.flags.host).toBe("0.0.0.0");
    expect(result.flags.port).toBe("5173");
  });

  test("missing value for value flag produces error", () => {
    const result = parseArgs(["run", "--device"]);
    expect(result.errors).toContain("Missing value for --device");
  });

  test("multiple short flags", () => {
    const result = parseArgs(["-vh"]);
    expect(result.version).toBe(true);
    expect(result.help).toBe(true);
  });

  test("unknown short flag produces error", () => {
    const result = parseArgs(["-x"]);
    expect(result.errors).toContain("Unknown short flag: -x");
  });

  test("unknown long flag produces error", () => {
    expect(parseArgs(["build", "--relese"]).errors).toContain("Unknown flag: --relese");
  });

  test("boolean flags reject inline values", () => {
    expect(parseArgs(["build", "--release=false"]).errors).toContain("Flag --release does not take a value");
  });

  test("--all flag with value flags", () => {
    const result = parseArgs(["deploy", "--all", "--variant", "release"]);
    expect(result.flags.all).toBe(true);
    expect(result.flags.variant).toBe("release");
  });

  test("kitchen sink", () => {
    const result = parseArgs(["dev", "--wifi", "--host", "0.0.0.0", "--port", "5173", "-v"]);
    expect(result.command).toBe("dev");
    expect(result.flags.wifi).toBe(true);
    expect(result.flags.host).toBe("0.0.0.0");
    expect(result.flags.port).toBe("5173");
    expect(result.version).toBe(true);
  });
});
