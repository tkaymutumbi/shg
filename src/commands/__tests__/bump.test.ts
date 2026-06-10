import { describe, expect, test } from "bun:test";

// parseVersion is not exported from bump.ts, so we test through the module's behavior
// This test file verifies the version parsing logic directly
import { parseVersion } from "../bump.js";

describe("parseVersion", () => {
  test("parses semver", () => {
    const v = parseVersion("1.2.3");
    expect(v.versionName).toBe("1.2.3");
    expect(v.versionCode).toBe(10203);
  });

  test("handles single digit", () => {
    const v = parseVersion("2");
    expect(v.versionName).toBe("2.0.0");
    expect(v.versionCode).toBe(20000);
  });

  test("handles two parts", () => {
    const v = parseVersion("3.1");
    expect(v.versionName).toBe("3.1.0");
    expect(v.versionCode).toBe(30100);
  });

  test("strips v prefix", () => {
    const v = parseVersion("v2.0.1");
    expect(v.versionName).toBe("2.0.1");
    expect(v.versionCode).toBe(20001);
  });

  test("handles large numbers", () => {
    const v = parseVersion("2026.4.0");
    expect(v.versionName).toBe("2026.4.0");
    expect(v.versionCode).toBe(20260400);
  });
});
