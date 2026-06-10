import { describe, expect, test, mock, beforeEach } from "bun:test";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

mock.module("execa", () => ({
  execa: async (cmd: string, args: string[], opts: any) => ({
    exitCode: 0,
    stdout: "mocked",
    stderr: "",
  }),
  execaSync: () => ({ exitCode: 0, stdout: "mocked\n", stderr: "" }),
}));

// Mock figlet to avoid ascii art in tests
mock.module("figlet", () => ({
  textSync: () => "SHG",
  default: { textSync: () => "SHG" },
}));

// Mock chalk since it re-exports from 'chalk/source' which can have issues
mock.module("chalk", () => {
  const noop = (s: string) => s;
  const chalk = Object.assign(noop, {
    red: noop,
    green: noop,
    yellow: noop,
    cyan: noop,
    dim: noop,
    bgCyan: noop,
    black: noop,
  });
  return { default: chalk, ...chalk };
});

// We need to mock @clack/prompts for all tests
mock.module("@clack/prompts", () => ({
  isCancel: () => false,
  cancel: () => {},
  intro: () => {},
  outro: () => {},
  select: async () => "dev",
  multiselect: async () => ["install"],
  text: async () => "test",
  confirm: async () => true,
  spinner: () => ({ start: () => {}, stop: () => {}, message: () => {} }),
  CancelSymbol: Symbol("clack:cancel"),
}));

// Import all command handlers after mocks
const { runAssets } = await import("../assets.js");
const { runBuild } = await import("../build.js");
const { runClean } = await import("../clean.js");
const { runDevices } = await import("../devices.js");
const { runLogs } = await import("../logs.js");
const { runOpen } = await import("../open.js");
const { runSetup } = await import("../setup.js");
const { runUpgrade } = await import("../upgrade.js");
const { runDoctor } = await import("../doctor.js");
const { runConfig } = await import("../config.js");
const { runBump } = await import("../bump.js");
const { runDev } = await import("../dev.js");
const { runPlugin } = await import("../plugin.js");
const { runRun } = await import("../run.js");
const { runDeploy } = await import("../deploy.js");
const { runCreate } = await import("../create.js");
const { requireProjectRoot } = await import("../../core/project.js");

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

describe("runDevices", () => {
  test("lists devices in human format", async () => {
    const result = await runDevices(makeContext());
    expect(result.exitCode).toBe(0);
  });

  test("lists devices in json format", async () => {
    const result = await runDevices(makeContext({ json: true }));
    expect(result.exitCode).toBe(0);
  });
});

describe("runLogs", () => {
  test("starts logcat with default filter", async () => {
    const result = await runLogs(makeContext());
    expect(result.exitCode).toBe(0);
  });

  test("json output", async () => {
    const result = await runLogs(makeContext({ json: true }));
    expect(result.exitCode).toBe(0);
  });

  test("custom tag and level", async () => {
    const result = await runLogs(makeContext({ flags: { tag: "MyApp", level: "E" } }));
    expect(result.exitCode).toBe(0);
  });
});

describe("runOpen", () => {
  test("opens android platform", async () => {
    const result = await runOpen(makeContext());
    expect(result.exitCode).toBe(0);
  });
});

describe("runAssets", () => {
  test("generates assets", async () => {
    const result = await runAssets(makeContext());
    expect(result.exitCode).toBe(0);
  });
});

describe("runClean", () => {
  test("cleans targets", async () => {
    const result = await runClean(makeContext());
    expect(result.exitCode).toBe(0);
  });

  test("json output", async () => {
    const result = await runClean(makeContext({ json: true }));
    expect(result.exitCode).toBe(0);
  });
});

describe("runSetup", () => {
  test("runs selected steps", async () => {
    const result = await runSetup(makeContext({ flags: { install: true } }));
    expect(result.exitCode).toBe(0);
  });

  test("requires project root for non-install steps", async () => {
    const result = await runSetup(makeContext({ projectRoot: undefined, flags: { init: true } }));
    expect(result.exitCode).toBe(1);
  });
});

describe("runUpgrade", () => {
  test("checks versions", async () => {
    const result = await runUpgrade(makeContext());
    expect(result.exitCode).toBe(0);
  });

  test("runs upgrade with --run flag", async () => {
    const result = await runUpgrade(makeContext({ flags: { run: true } }));
    expect(result.exitCode).toBe(0);
  });
});

describe("runDoctor", () => {
  test("runs diagnostics", async () => {
    const result = await runDoctor(makeContext());
    expect(result.exitCode).toBe(0);
  });

  test("json output", async () => {
    const result = await runDoctor(makeContext({ json: true }));
    expect(result.exitCode).toBe(0);
  });

  test("no project root", async () => {
    const result = await runDoctor(makeContext({ projectRoot: undefined }));
    expect(result.exitCode).toBe(1);
  });
});

describe("runBuild", () => {
  test("builds debug by default", async () => {
    const result = await runBuild(makeContext());
    expect(result.exitCode).toBe(0);
  });

  test("builds release", async () => {
    const result = await runBuild(makeContext({ flags: { release: true } }));
    expect(result.exitCode).toBe(0);
  });

  test("json output", async () => {
    const result = await runBuild(makeContext({ flags: { release: true }, json: true }));
    expect(result.exitCode).toBe(0);
  });
});

describe("runBump", () => {
  let tmpProject: string;

  beforeEach(() => {
    tmpProject = mkdtempSync(join(tmpdir(), "shg-bump-"));
    writeFileSync(join(tmpProject, "capacitor.config.json"), JSON.stringify({
      appId: "com.test.app",
      appName: "Test",
      webDir: "dist",
      version: "1.0.0",
      versionName: "1.0.0",
      versionCode: 1,
    }));
  });

  test("bumps with --to flag", async () => {
    const result = await runBump(makeContext({ projectRoot: tmpProject, flags: { to: "2.0.0" } }));
    expect(result.exitCode).toBe(0);
    const raw = require("node:fs").readFileSync(join(tmpProject, "capacitor.config.json"), "utf8");
    const updated = JSON.parse(raw);
    expect(updated.versionName).toBe("2.0.0");
    expect(updated.versionCode).toBe(20000);
  });

  test("fails without project root", async () => {
    const result = await runBump(makeContext({ projectRoot: undefined }));
    expect(result.exitCode).toBe(1);
  });
});

describe("runPlugin", () => {
  test("lists plugins", async () => {
    const result = await runPlugin(makeContext(), ["list"]);
    expect(result.exitCode).toBe(0);
  });

  test("adds a plugin", async () => {
    const result = await runPlugin(makeContext(), ["add", "@capacitor/camera"]);
    expect(result.exitCode).toBe(0);
  });

  test("syncs plugins", async () => {
    const result = await runPlugin(makeContext(), ["sync"]);
    expect(result.exitCode).toBe(0);
  });

  test("errors without plugin name on add", async () => {
    const result = await runPlugin(makeContext(), ["add"]);
    expect(result.exitCode).toBe(2);
  });
});

describe("runConfig", () => {
  test("lists config", async () => {
    const result = await runConfig(makeContext(), []);
    expect(result.exitCode).toBe(0);
  });

  test("gets a key", async () => {
    const result = await runConfig(makeContext(), ["get", "defaultVariant"]);
    expect(result.exitCode).toBe(0);
  });

  test("errors for missing key", async () => {
    const result = await runConfig(makeContext(), ["get", "nonexistent"]);
    expect(result.exitCode).toBe(1);
  });

  test("errors for get without key", async () => {
    const result = await runConfig(makeContext(), ["get"]);
    expect(result.exitCode).toBe(2);
  });

  test("sets a local key", async () => {
    const tmpProject = mkdtempSync(join(tmpdir(), "shg-config-"));
    const result = await runConfig(makeContext({ projectRoot: tmpProject }), ["set", "defaultVariant", "release"]);
    expect(result.exitCode).toBe(0);
    const configPath = join(tmpProject, ".shgrc.json");
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(require("node:fs").readFileSync(configPath, "utf8"));
    expect(config.defaultVariant).toBe("release");
  });

  test("sets a global key", async () => {
    const tmpHome = mkdtempSync(join(tmpdir(), "shg-home-"));
    mock.module("node:os", () => ({
      homedir: () => tmpHome,
      networkInterfaces: () => ({}),
    }));
    const { runConfig: runConfigReloaded } = await import("../config.js");
    const result = await runConfigReloaded(makeContext({ flags: { global: true } }), ["set", "output.verbose", "true"]);
    expect(result.exitCode).toBe(0);
    const globalConfigPath = join(tmpHome, ".config", "shg", "config.json");
    expect(existsSync(globalConfigPath)).toBe(true);
  });

  test("shows config path", async () => {
    const result = await runConfig(makeContext(), ["path"]);
    expect(result.exitCode).toBe(0);
  });

  test("errors for unknown subcommand", async () => {
    const result = await runConfig(makeContext(), ["foobar"]);
    expect(result.exitCode).toBe(2);
  });
});
