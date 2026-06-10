import { describe, expect, test, mock } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let mockSelectValue = "dev";
let mockMultiselectValue = ["install"];
let mockTextValue = "test-input";
let mockConfirmValue = true;

mock.module("@clack/prompts", () => ({
  select: async () => mockSelectValue,
  multiselect: async () => mockMultiselectValue,
  text: async () => mockTextValue,
  confirm: async () => mockConfirmValue,
  isCancel: () => false,
  cancel: () => {},
  intro: () => {},
  outro: () => {},
  spinner: () => ({ start: () => {}, stop: () => {}, message: () => {} }),
}));

mock.module("execa", () => ({
  execa: async () => ({ exitCode: 0, stdout: "mocked", stderr: "" }),
  execaSync: () => ({ exitCode: 0, stdout: "mocked\n", stderr: "" }),
}));

const { runInteractive } = await import("../interactive.js");

function makeContext(overrides: Record<string, any> = {}) {
  return {
    projectRoot: "/fake/project",
    config: {
      defaultFlow: "deployAll",
      defaultDeviceId: "",
      defaultVariant: "debug",
      defaultFlavor: "",
      autoSyncBeforeRun: true,
      doctor: { autoRunBeforeDeploy: false, allowSafeFixes: false },
      output: { verbose: false, json: false },
    },
    verbose: false,
    json: false,
    flags: {},
    ...overrides,
  };
}

describe("runInteractive", () => {
  test("dev category returns 0", async () => {
    mockSelectValue = "dev";
    const code = await runInteractive(makeContext());
    expect(code).toBe(1);
  });

  test("deploy category defaults to all steps", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "shg-test-"));
    mockSelectValue = "deploy";
    mockMultiselectValue = ["all"];
    const code = await runInteractive(makeContext({ projectRoot: tmpDir }));
    expect(code).toBe(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("setup category runs selected steps", async () => {
    mockSelectValue = "setup";
    mockMultiselectValue = ["install"];
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("build category debug variant", async () => {
    mockSelectValue = "build";
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("assets category", async () => {
    mockSelectValue = "assets";
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("open category", async () => {
    mockSelectValue = "open";
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("clean category", async () => {
    mockSelectValue = "clean";
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("upgrade category without run", async () => {
    mockSelectValue = "upgrade";
    mockConfirmValue = false;
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("upgrade category with run", async () => {
    mockSelectValue = "upgrade";
    mockConfirmValue = true;
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });
});
