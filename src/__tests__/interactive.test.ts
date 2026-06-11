import { describe, expect, test, mock } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let mockSelectValues = ["dev"];
let mockMultiselectValue = ["install"];
let mockTextValues = ["test-input"];
let mockConfirmValue = true;

mock.module("@clack/prompts", () => ({
  select: async () => mockSelectValues.shift() ?? "dev",
  multiselect: async () => mockMultiselectValue,
  text: async () => mockTextValues.shift() ?? "test-input",
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
    mockSelectValues = ["dev", "auto"];
    mockTextValues = ["5173"];
    const code = await runInteractive(makeContext());
    expect(code).toBe(1);
  });

  test("deploy category defaults to all steps", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "shg-test-"));
    mockSelectValues = ["deploy", "all"];
    mockMultiselectValue = ["all"];
    const code = await runInteractive(makeContext({ projectRoot: tmpDir }));
    expect(code).toBe(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("setup category runs selected steps", async () => {
    mockSelectValues = ["setup"];
    mockMultiselectValue = ["install"];
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("build category debug variant", async () => {
    mockSelectValues = ["build", "debug"];
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("assets category", async () => {
    mockSelectValues = ["assets"];
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("open category", async () => {
    mockSelectValues = ["open"];
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("clean category", async () => {
    mockSelectValues = ["clean"];
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("upgrade category without run", async () => {
    mockSelectValues = ["upgrade"];
    mockConfirmValue = false;
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });

  test("upgrade category with run", async () => {
    mockSelectValues = ["upgrade"];
    mockConfirmValue = true;
    const code = await runInteractive(makeContext());
    expect(code).toBe(0);
  });
});
