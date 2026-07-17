import { beforeEach, describe, expect, mock, test } from "bun:test";

type Device = { id: string; status: string; model?: string };

let deviceLists: Device[][] = [];
let connectResult: string | undefined;
let confirmResult = true;
let runCommandCalls: Array<{ label: string; args: string[] }> = [];
let savedStates: Array<Record<string, unknown>> = [];
let state = {
  lastDeviceId: "192.168.1.22:44759",
  lastVariant: "debug",
  lastFlavor: "",
};

mock.module("@clack/prompts", () => ({
  isCancel: () => false,
  confirm: async () => confirmResult,
  select: async () => "wifi",
  text: async () => "",
  spinner: () => ({ start: () => {}, stop: () => {}, message: () => {} }),
}));

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

mock.module("../../core/android.js", () => ({
  listAndroidDevices: async () => deviceLists.shift() ?? [],
  connectOverWifi: async () => connectResult,
  loadWifiIp: () => "192.168.1.22",
}));

mock.module("../../core/project.js", () => ({
  requireProjectRoot: () => "/fake/project",
  readAppId: () => "com.example.app",
}));

mock.module("../../core/state.js", () => ({
  loadState: () => state,
  saveState: (_projectRoot: string, nextState: Record<string, unknown>) => {
    savedStates.push(nextState);
  },
}));

mock.module("../../core/executor.js", () => ({
  runCommand: async (command: { label: string; args?: string[] }) => {
    runCommandCalls.push({ label: command.label, args: command.args ?? [] });
    return { success: true, stdout: "", stderr: "" };
  },
}));

const { runRun } = await import("../run.js");

function makeContext() {
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
  };
}

describe("runRun wifi reconnect", () => {
  beforeEach(() => {
    deviceLists = [];
    connectResult = undefined;
    confirmResult = true;
    runCommandCalls = [];
    savedStates = [];
    state = {
      lastDeviceId: "192.168.1.22:44759",
      lastVariant: "debug",
      lastFlavor: "",
    };
  });

  test("reports wifi reconnect failure instead of the stale saved target", async () => {
    deviceLists = [[], []];
    const errorCalls: string[] = [];
    const logCalls: string[] = [];
    const originalError = console.error;
    const originalLog = console.log;
    console.error = (...args: unknown[]) => {
      errorCalls.push(args.map(String).join(" "));
    };
    console.log = (...args: unknown[]) => {
      logCalls.push(args.map(String).join(" "));
    };

    const result = await runRun(makeContext());

    expect(result.exitCode).toBe(1);
    expect(errorCalls.some((msg) => msg.includes("WiFi reconnect did not produce a ready device."))).toBe(true);
    expect(errorCalls.some((msg) => msg.includes('Target device "192.168.1.22:44759" not found.'))).toBe(false);
    expect(logCalls.some((msg) => msg.includes("Available: none"))).toBe(true);

    console.error = originalError;
    console.log = originalLog;
  });

  test("uses the newly connected wifi target for the run command", async () => {
    connectResult = "192.168.1.22:38355";
    deviceLists = [
      [],
      [{ id: "192.168.1.22:38355", status: "device", model: "Pixel" }],
    ];

    const result = await runRun(makeContext());

    expect(result.exitCode).toBe(0);
    expect(runCommandCalls.some((call) =>
      call.label === "bunx cap run android"
      && call.args.includes("--target")
      && call.args.includes("192.168.1.22:38355"))).toBe(true);
    expect(savedStates.at(-1)?.lastDeviceId).toBe("192.168.1.22:38355");
  });
});
