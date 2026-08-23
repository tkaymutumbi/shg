import { describe, expect, test, mock } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

mock.module("execa", () => ({
  execa: async (cmd: string, args: string[]) => ({
    exitCode: 0,
    stdout: cmd === "adb" && args[0] === "devices"
      ? "List of devices attached\n192.168.1.25:37123\tdevice\n"
      : cmd === "adb" && args[0] === "shell" && args[1] === "am"
        ? "Starting: Intent { cmp=com.example/.MainActivity }"
        : "Success\nVersion 34.0.5",
    stderr: "",
  }),
  execaSync: () => ({ exitCode: 0, stdout: "", stderr: "" }),
}));

const { buildInstallArgs, classifyInstallFailure, explainInstallFailure, runInstall } = await import("../install.js");

describe("install command", () => {
  test("constructs a replace-and-downgrade adb install", () => {
    expect(buildInstallArgs("192.168.1.25:37123", "/tmp/app-release.apk")).toEqual([
      "-s", "192.168.1.25:37123", "install", "-r", "-d", "/tmp/app-release.apk",
    ]);
  });

  test("explains common signing and downgrade failures", () => {
    expect(classifyInstallFailure("INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match")).toBe("signing");
    expect(classifyInstallFailure("INSTALL_FAILED_VERSION_DOWNGRADE")).toBe("downgrade");
    expect(explainInstallFailure("signing")).toContain("different key");
  });

  test("never treats an AAB as an installable APK", () => {
    expect(classifyInstallFailure("Cannot install app-release.aab: app bundle")).toBe("bundle");
    expect(explainInstallFailure("bundle")).toContain("AAB");
  });

  test("runs the no-build install and launch command", async () => {
    const project = mkdtempSync(join(tmpdir(), "shg-install-"));
    const apkDir = join(project, "android", "app", "build", "outputs", "apk", "debug");
    const manifestDir = join(project, "android", "app", "src", "main");
    mkdirSync(apkDir, { recursive: true });
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(join(project, "capacitor.config.json"), JSON.stringify({ appId: "com.example", webDir: "dist" }));
    writeFileSync(join(manifestDir, "AndroidManifest.xml"), `<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application><activity android:name=".MainActivity"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>`);
    const apkPath = join(apkDir, "app-debug.apk");
    writeFileSync(apkPath, "fake apk");

    const result = await runInstall({
      projectRoot: project,
      config: { defaultFlow: "deployAll", defaultDeviceId: "", defaultVariant: "debug", defaultFlavor: "", autoSyncBeforeRun: true, doctor: { autoRunBeforeDeploy: false, allowSafeFixes: false }, output: { verbose: false, json: false } },
      verbose: false,
      json: false,
      flags: { "no-build": true },
    });
    expect(result.exitCode).toBe(0);
    rmSync(project, { recursive: true, force: true });
  });
});
