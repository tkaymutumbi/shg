import { describe, expect, test } from "bun:test";
import { DEFAULT_CONFIG, mergeConfig } from "../config.js";

describe("mergeConfig", () => {
  test("returns base when no override", () => {
    const result = mergeConfig(DEFAULT_CONFIG);
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  test("overrides top-level keys", () => {
    const result = mergeConfig(DEFAULT_CONFIG, { defaultVariant: "release" });
    expect(result.defaultVariant).toBe("release");
    expect(result.defaultFlow).toBe(DEFAULT_CONFIG.defaultFlow);
  });

  test("deep merges doctor section", () => {
    const result = mergeConfig(DEFAULT_CONFIG, {
      doctor: { allowSafeFixes: true },
    });
    expect(result.doctor.allowSafeFixes).toBe(true);
    expect(result.doctor.autoRunBeforeDeploy).toBe(DEFAULT_CONFIG.doctor.autoRunBeforeDeploy);
  });

  test("deep merges output section", () => {
    const result = mergeConfig(DEFAULT_CONFIG, {
      output: { verbose: true },
    });
    expect(result.output.verbose).toBe(true);
    expect(result.output.json).toBe(DEFAULT_CONFIG.output.json);
  });

  test("empty override returns base", () => {
    const result = mergeConfig(DEFAULT_CONFIG, {});
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  test("ignores invalid runtime value types", () => {
    const malformed = {
      defaultVariant: 42,
      autoSyncBeforeRun: "yes",
      doctor: { autoRunBeforeDeploy: "yes" },
    } as unknown as Partial<typeof DEFAULT_CONFIG>;
    const merged = mergeConfig(DEFAULT_CONFIG, malformed);
    expect(merged.defaultVariant).toBe("debug");
    expect(merged.autoSyncBeforeRun).toBe(true);
    expect(merged.doctor.autoRunBeforeDeploy).toBe(true);
  });
});
