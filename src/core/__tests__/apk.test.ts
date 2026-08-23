import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findBuiltApk, selectApkForVariant } from "../apk.js";

describe("APK selection", () => {
  test("selects debug and release APKs without confusing them", () => {
    const root = "/project/android/app/build/outputs/apk";
    const files = [
      join(root, "debug", "app-debug.apk"),
      join(root, "release", "app-release.apk"),
      join(root, "free", "release", "app-free-release.apk"),
    ];
    expect(selectApkForVariant(files, root, "debug")).toBe(files[0]);
    expect(selectApkForVariant(files, root, "release")).toBe(files[1]);
    expect(selectApkForVariant(files, root, "release", "free")).toBe(files[2]);
  });

  test("does not guess a flavor when none was requested", () => {
    const root = "/project/android/app/build/outputs/apk";
    expect(selectApkForVariant([join(root, "free", "debug", "app-free-debug.apk")], root, "debug")).toBeUndefined();
  });

  test("finds an APK in a real Gradle output tree", () => {
    const project = mkdtempSync(join(tmpdir(), "shg-apk-"));
    const output = join(project, "android", "app", "build", "outputs", "apk", "release");
    mkdirSync(output, { recursive: true });
    const apk = join(output, "app-release.apk");
    writeFileSync(apk, "fake apk");
    expect(findBuiltApk(project, "release")).toBe(apk);
    rmSync(project, { recursive: true, force: true });
  });
});
